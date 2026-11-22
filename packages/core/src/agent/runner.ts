import {
  answersPrompt,
  buildTurnPrompt,
  editedPrompt,
  type PromptOptions,
  rewoundPrompt,
  systemPromptAppend,
} from './prompt.ts';
import type { AgentProvider, ProviderEvent } from './provider.ts';
import { newId, type SessionStore, titleFromPrompt } from './store.ts';
import type { AgentEffort, AgentProviderId, AgentTurnContext, RespondPayload } from './types.ts';

type SendOptions = {
  text: string;
  context?: AgentTurnContext;
  model?: string | null;
  effort?: AgentEffort | null;
  // Set when the turn answers questions the agent asked in its last reply:
  // the question item stands in for the user message.
  answering?: string;
  // A user message to replace: the transcript is cut back to it and the
  // turn runs again from there with the new text.
  edit?: string;
};

export type TurnSettings = Partial<Pick<SendOptions, 'context' | 'model' | 'effort'>>;

export type TurnEnd = { sessionId: string; userItemId: string };

export type AgentRunner = ReturnType<typeof createAgentRunner>;

export function createAgentRunner(opts: {
  userCwd: string;
  writableRoots: string[];
  store: SessionStore;
  providers: Record<AgentProviderId, AgentProvider>;
  promptOptions?: () => PromptOptions;
  onTurnEnd?: (turn: TurnEnd) => void | Promise<void>;
}) {
  const { userCwd, writableRoots, store, providers, onTurnEnd } = opts;
  const promptOptions = opts.promptOptions ?? (() => ({ framesDir: 'frames' }));
  const running = new Map<string, AbortController>();
  const lastOptions = new Map<string, SendOptions>();

  const now = () => new Date().toISOString();

  function isRunning(sessionId: string): boolean {
    return running.has(sessionId);
  }

  async function send(sessionId: string, options: SendOptions): Promise<void> {
    const session = store.get(sessionId);
    if (!session) throw new Error(`unknown agent session: ${sessionId}`);
    if (running.has(sessionId)) throw new Error('session is already running');
    const text = options.text.trim();
    if (!text) throw new Error('empty prompt');

    const provider = providers[session.provider];
    const context = options.context;
    let promptText = text;
    let resumeAt: string | null = null;
    if (options.edit) {
      const index = session.items.findIndex((i) => i.id === options.edit);
      const target = session.items[index];
      if (target?.kind !== 'user') throw new Error('unknown message');
      // Once old items were trimmed, the oldest message left is not where the
      // provider's history starts, so it can't restart from scratch.
      const first =
        !session.trimmed && !session.items.slice(0, index).some((i) => i.kind === 'user');
      if (first) {
        store.patch(sessionId, { providerSessionId: null, providerCheckpoint: null });
      } else if (provider.canRewind && target.resumeAt) {
        resumeAt = target.resumeAt;
        store.patch(sessionId, { providerCheckpoint: resumeAt });
        promptText = rewoundPrompt(text);
      } else {
        promptText = editedPrompt(target.text, text);
      }
      store.truncateFrom(sessionId, target.id);
    }

    const controller = new AbortController();
    running.set(sessionId, controller);

    lastOptions.set(sessionId, { ...options, edit: undefined });
    if (session.items.length === 0) store.patch(sessionId, { title: titleFromPrompt(text) });
    if (context?.frameId && !session.frameId) {
      store.patch(sessionId, { frameId: context.frameId });
    }
    for (const item of session.items) {
      if (item.kind === 'question' && item.status === 'pending' && item.id !== options.answering) {
        store.updateItem(sessionId, item.id, 'question', { status: 'cancelled' });
      }
    }
    const userItemId = options.answering ?? newId('u');
    if (!options.answering) {
      store.appendItem(sessionId, {
        kind: 'user',
        id: userItemId,
        ts: now(),
        text,
        ...(session.providerCheckpoint ? { resumeAt: session.providerCheckpoint } : {}),
      });
    }
    store.patch(sessionId, { status: 'running' });

    const openText = new Set<string>();
    const openTools = new Set<string>();
    const startedAt = Date.now();
    let resultSeen = false;

    const emit = (event: ProviderEvent) => {
      if (!store.get(sessionId)) return;
      switch (event.type) {
        case 'session-id':
          store.patch(sessionId, { providerSessionId: event.id });
          return;
        case 'checkpoint':
          store.patch(sessionId, { providerCheckpoint: event.id });
          return;
        case 'text-start':
          openText.add(event.id);
          store.appendItem(sessionId, {
            kind: 'assistant',
            id: event.id,
            ts: now(),
            text: '',
            streaming: true,
          });
          return;
        case 'text-delta':
          if (!openText.has(event.id)) emit({ type: 'text-start', id: event.id });
          store.appendDelta(sessionId, event.id, event.text);
          return;
        case 'text-end': {
          if (!openText.has(event.id)) {
            if (!event.text) return;
            emit({ type: 'text-start', id: event.id });
          }
          openText.delete(event.id);
          const changes =
            event.text !== null ? { streaming: false, text: event.text } : { streaming: false };
          store.updateItem(sessionId, event.id, 'assistant', changes);
          return;
        }
        case 'tool-start':
          openTools.add(event.id);
          store.appendItem(sessionId, {
            kind: 'tool',
            id: event.id,
            ts: now(),
            name: event.name,
            title: event.title,
            detail: event.detail,
            status: 'running',
          });
          return;
        case 'tool-end':
          openTools.delete(event.id);
          store.updateItem(sessionId, event.id, 'tool', { status: event.ok ? 'done' : 'error' });
          return;
        case 'error':
          store.appendItem(sessionId, {
            kind: 'error',
            id: newId('e'),
            ts: now(),
            text: event.text,
          });
          return;
        case 'questions':
          store.appendItem(sessionId, {
            kind: 'question',
            id: newId('q'),
            ts: now(),
            questions: event.questions,
            answers: null,
            status: 'pending',
          });
          return;
        case 'result':
          resultSeen = true;
          store.appendItem(sessionId, {
            kind: 'result',
            id: newId('r'),
            ts: now(),
            durationMs: event.durationMs ?? Date.now() - startedAt,
            costUsd: event.costUsd,
            aborted: false,
          });
          return;
      }
    };

    const finish = () => {
      running.delete(sessionId);
      if (!store.get(sessionId)) return;
      for (const id of openText) {
        store.updateItem(sessionId, id, 'assistant', { streaming: false });
      }
      for (const id of openTools) {
        store.updateItem(sessionId, id, 'tool', { status: 'error' });
      }
      if (!resultSeen) {
        store.appendItem(sessionId, {
          kind: 'result',
          id: newId('r'),
          ts: now(),
          durationMs: Date.now() - startedAt,
          costUsd: null,
          aborted: controller.signal.aborted,
        });
      }
      store.patch(sessionId, { status: 'idle' });
      if (onTurnEnd) {
        void Promise.resolve()
          .then(() => onTurnEnd({ sessionId, userItemId }))
          .catch((err: unknown) => {
            console.error('[open-design-frame] agent turn-end handler failed:', err);
          });
      }
    };

    const promptOpts = promptOptions();
    void provider
      .run({
        cwd: userCwd,
        writableRoots,
        prompt: buildTurnPrompt(promptText, context, promptOpts.framesDir),
        systemPromptAppend: systemPromptAppend(provider.askInstruction, {
          ...promptOpts,
          canOpenBrowser: provider.canOpenBrowser,
        }),
        resume: session.providerSessionId,
        resumeAt,
        model: options.model ?? null,
        effort: options.effort ?? null,
        signal: controller.signal,
        emit,
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        emit({ type: 'error', text: err instanceof Error ? err.message : String(err) });
      })
      .finally(finish);
  }

  function stop(sessionId: string): boolean {
    const controller = running.get(sessionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  /**
   * Answers questions the agent ended its last turn with, which starts the
   * next turn. The panel sends its current settings; what the last turn used
   * only fills the gaps, e.g. a client that sent none.
   */
  function respond(
    sessionId: string,
    itemId: string,
    payload: RespondPayload,
    next: TurnSettings = {},
  ): boolean {
    const item = store.get(sessionId)?.items.find((i) => i.id === itemId);
    if (item?.kind !== 'question' || item.status !== 'pending' || running.has(sessionId)) {
      return false;
    }
    const answers = 'answers' in payload ? payload.answers : null;
    store.updateItem(sessionId, itemId, 'question', {
      answers,
      status: answers ? 'answered' : 'cancelled',
    });
    const previous = { ...lastOptions.get(sessionId), ...next };
    void send(sessionId, {
      ...previous,
      text: answersPrompt(item.questions, answers),
      answering: itemId,
    }).catch((err: unknown) => {
      console.error('[open-design-frame] agent turn failed:', err);
    });
    return true;
  }

  function stopAll(): void {
    for (const id of Array.from(running.keys())) stop(id);
  }

  return { send, stop, respond, isRunning, stopAll };
}
