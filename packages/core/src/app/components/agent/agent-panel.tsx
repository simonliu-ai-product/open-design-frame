import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyCommentsPrompt, CREATE_FRAME_PROMPT } from '../../../agent/prompt.ts';
import type {
  AgentEffort,
  AgentModelOption,
  AgentProviderId,
  AgentTurnContext,
  RespondPayload,
} from '../../../agent/types.ts';
import {
  autoConnect,
  createSession,
  deleteSession,
  respond,
  sendMessage,
  setActiveSession,
  setModelChoice,
  stopSession,
  useAgentSession,
  useAgentSessions,
  useAgentStatus,
} from '../../lib/agent.ts';
import { type TFunction, useT } from '../../lib/i18n.tsx';
import { Composer, ContextChip } from './composer.tsx';
import { ConnectView } from './connect-view.tsx';
import { HistoryView } from './history-view.tsx';
import { ProviderLogo } from './provider-logo.tsx';
import { Transcript } from './transcript.tsx';

export function AgentPanel({
  context,
  onClose,
}: {
  context: AgentTurnContext;
  onClose: () => void;
}) {
  const t = useT();
  const { status, loading, connected, provider, model, effort, modelChoices } = useAgentStatus();
  const { sessions, loaded: sessionsLoaded, activeId } = useAgentSessions();
  const session = useAgentSession(activeId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const running = session?.status === 'running';
  const showConnect = !loading && (!connected || manage);

  useEffect(() => {
    if (status) void autoConnect();
  }, [status]);

  const contextRef = useRef(context);
  contextRef.current = context;

  // Arriving at another file starts a new conversation; the previous one stays
  // in history. Picking a chat from history opens its own file, so it
  // survives this check.
  const frameId = context.frameId ?? null;
  const checkedRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!sessionsLoaded || checkedRef.current === frameId) return;
    checkedRef.current = frameId;
    const active = activeId ? sessions.find((s) => s.id === activeId) : null;
    if (active?.frameId && active.frameId !== frameId) setActiveSession(null);
  }, [frameId, sessionsLoaded, activeId, sessions]);

  const fail = useCallback(
    (err: unknown) =>
      setNotice(t('agent.sendFailed', { error: err instanceof Error ? err.message : String(err) })),
    [t],
  );

  const send = useCallback(
    async (text: string, fresh = false) => {
      const trimmed = text.trim();
      // A second turn would edit the same file alongside the running one.
      if (!trimmed || sendingRef.current || (running && !fresh) || !provider) return;
      sendingRef.current = true;
      setSending(true);
      setNotice(null);
      try {
        const current = activeId ? sessions.find((s) => s.id === activeId) : null;
        const id =
          !fresh && current && current.status !== 'running' && current.provider === provider.id
            ? current.id
            : (await createSession(provider.id, contextRef.current.frameId ?? null)).id;
        setDraft('');
        await sendMessage(id, trimmed, contextRef.current);
      } catch (err) {
        fail(err);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [activeId, sessions, provider, running, fail],
  );

  const onRespond = useCallback(
    async (itemId: string, payload: RespondPayload) => {
      if (!session) return;
      await respond(session.id, itemId, payload, contextRef.current).catch(fail);
    },
    [session, fail],
  );

  const onEdit = useCallback(
    async (itemId: string, text: string) => {
      if (!session) return;
      await sendMessage(session.id, text, contextRef.current, itemId).catch(fail);
    },
    [session, fail],
  );

  const pending = context.pendingComments ?? 0;
  const applyComments = () => context.frameId && send(applyCommentsPrompt(context.frameId));

  const chips: ReactNode = context.frameId ? (
    <>
      <ContextChip title={context.frameId}>
        {context.artboard?.name ?? context.frameTitle ?? context.frameId}
      </ContextChip>
      {context.selection ? (
        <ContextChip title={context.selection.text || undefined}>
          {context.selection.label}
        </ContextChip>
      ) : null}
      {pending > 0 ? (
        <ContextChip
          tone="accent"
          title={t('agent.quickApplyHint')}
          onClick={running ? undefined : applyComments}
        >
          {t('comments.count', {
            n: pending,
            unit: pending === 1 ? t('comments.singular') : t('comments.plural'),
          })}{' '}
          · {t('agent.quickApply')}
        </ContextChip>
      ) : null}
    </>
  ) : null;

  return (
    <div className="odf-agent" data-agent-provider={provider?.id}>
      {running ? <span aria-hidden="true" className="odf-agent-progress" /> : null}
      <header className="odf-panel-head odf-agent-head">
        <div className="odf-agent-head-left">
          {showConnect && connected ? (
            <button type="button" className="odf-agent-ghost" onClick={() => setManage(false)}>
              ‹ {t('agent.backToChat')}
            </button>
          ) : view === 'history' ? (
            <button type="button" className="odf-agent-ghost" onClick={() => setView('chat')}>
              ‹ {t('agent.history')}
            </button>
          ) : connected && provider ? (
            <ModelMenu
              providerId={provider.id}
              models={provider.models}
              model={model}
              effort={effort}
              onChoose={(m, e) => setModelChoice(provider.id, { model: m, effort: e })}
              currentEffortChoice={modelChoices[provider.id]?.effort ?? null}
              onManage={() => setManage(true)}
            />
          ) : (
            <span className="odf-panel-title">{t('agent.title')}</span>
          )}
          <span className="odf-agent-beta" title={t('agent.betaHint')}>
            {t('agent.beta')}
          </span>
        </div>
        <div className="odf-agent-head-right">
          {connected && !showConnect ? (
            <>
              <button
                type="button"
                className="odf-agent-action"
                aria-label={t('agent.history')}
                aria-pressed={view === 'history'}
                title={t('agent.history')}
                onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
              >
                <span aria-hidden="true">☰</span>
              </button>
              <button
                type="button"
                className="odf-agent-action"
                aria-label={t('agent.newSession')}
                title={t('agent.newSession')}
                onClick={() => {
                  setActiveSession(null);
                  setView('chat');
                  setDraft('');
                  setNotice(null);
                  queueMicrotask(() => textareaRef.current?.focus());
                }}
              >
                <span aria-hidden="true">＋</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="odf-close"
            aria-label={t('agent.close')}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </header>

      {loading ? (
        <p className="odf-agent-hint odf-agent-pad">{t('agent.statusLoading')}</p>
      ) : showConnect ? (
        <ConnectView />
      ) : view === 'history' ? (
        <HistoryView
          sessions={sessions}
          activeId={activeId}
          frameId={frameId}
          onSelect={(s) => {
            setActiveSession(s.id);
            setView('chat');
            if (s.frameId && s.frameId !== frameId) navigate(`/f/${s.frameId}`);
          }}
          onDelete={(id) => void deleteSession(id).catch(fail)}
        />
      ) : (
        <>
          {session && session.items.length > 0 ? (
            <Transcript session={session} onRespond={onRespond} onEdit={onEdit} onFix={send} />
          ) : (
            <EmptyState
              pendingComments={pending}
              hasFrame={Boolean(context.frameId)}
              onApply={applyComments}
              onCreate={() => send(CREATE_FRAME_PROMPT, true)}
              onEdit={() => textareaRef.current?.focus()}
            />
          )}
          {notice ? (
            <p className="odf-agent-notice" role="alert">
              {notice}
            </p>
          ) : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft)}
            onStop={() => session && stopSession(session.id).catch(fail)}
            running={Boolean(running)}
            busy={sending}
            placeholder={t('agent.composerPlaceholder', { provider: provider?.name ?? '' })}
            chips={chips}
            textareaRef={textareaRef}
          />
        </>
      )}
    </div>
  );
}

function modelLabel(model: AgentModelOption, t: TFunction): string {
  return model.id ? model.label : t('agent.modelDefault');
}

function ModelMenu({
  providerId,
  models,
  model,
  effort,
  currentEffortChoice,
  onChoose,
  onManage,
}: {
  providerId: AgentProviderId;
  models: AgentModelOption[];
  model: AgentModelOption | null;
  effort: AgentEffort | null;
  currentEffortChoice: AgentEffort | null;
  onChoose: (model: string, effort: AgentEffort | null) => void;
  onManage: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const selected = model;

  return (
    <div className="odf-agent-model" ref={ref}>
      <button
        type="button"
        className="odf-agent-ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ProviderLogo provider={providerId} className="odf-agent-logo" />
        <span>{model ? modelLabel(model, t) : t('agent.title')}</span>
        {effort ? <small>{t(`agent.effort.${effort}`)}</small> : null}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="odf-agent-menu" data-agent-model-menu>
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              className="odf-agent-menu-item"
              aria-pressed={m.id === selected?.id}
              onClick={() => onChoose(m.id, currentEffortChoice)}
            >
              <span>{modelLabel(m, t)}</span>
              {m.id === selected?.id ? <b aria-hidden="true">✓</b> : null}
            </button>
          ))}
          {selected && selected.efforts.length > 0 ? (
            <div className="odf-agent-menu-section">
              <span className="odf-agent-eyebrow">{t('agent.reasoning')}</span>
              <div className="odf-segment">
                {([null, ...selected.efforts] as (AgentEffort | null)[]).map((e) => (
                  <button
                    key={e ?? 'auto'}
                    type="button"
                    className="odf-seg"
                    aria-current={e === effort}
                    aria-pressed={e === effort}
                    onClick={() => onChoose(selected.id, e)}
                  >
                    {e ? t(`agent.effort.${e}`) : t('agent.effortAuto')}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="odf-agent-menu-section">
            <button
              type="button"
              className="odf-agent-menu-item"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              <span>{t('agent.manage')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  pendingComments,
  hasFrame,
  onApply,
  onCreate,
  onEdit,
}: {
  pendingComments: number;
  hasFrame: boolean;
  onApply: () => void;
  onCreate: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  return (
    <div className="odf-agent-scroll odf-agent-empty">
      <div>
        <span className="odf-agent-eyebrow">{t('agent.title')}</span>
        <h2>{t('agent.emptyTitle')}</h2>
        <p className="odf-agent-lede">{t('agent.emptyHint')}</p>
        <div className="odf-agent-quick">
          {hasFrame && pendingComments > 0 ? (
            <QuickAction
              tone="accent"
              icon="✎"
              label={`${t('agent.quickApply')} · ${pendingComments}`}
              hint={t('agent.quickApplyHint')}
              onClick={onApply}
            />
          ) : null}
          {hasFrame ? (
            <QuickAction
              icon="◎"
              label={t('agent.quickEdit')}
              hint={t('agent.quickEditHint')}
              onClick={onEdit}
            />
          ) : null}
          <QuickAction
            icon="＋"
            label={t('agent.quickCreate')}
            hint={t('agent.quickCreateHint')}
            onClick={onCreate}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  tone,
  onClick,
}: {
  icon: string;
  label: string;
  hint: string;
  tone?: 'accent';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={tone ? 'odf-agent-quick-item odf-agent-quick-accent' : 'odf-agent-quick-item'}
      onClick={onClick}
    >
      <i aria-hidden="true">{icon}</i>
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
    </button>
  );
}
