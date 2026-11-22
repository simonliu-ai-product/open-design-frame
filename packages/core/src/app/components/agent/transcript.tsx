import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { checkFixPrompt } from '../../../agent/prompt.ts';
import type {
  AgentItem,
  AgentQuestion,
  AgentSession,
  RespondPayload,
} from '../../../agent/types.ts';
import { useT } from '../../lib/i18n.tsx';
import { AgentMarkdown } from './agent-markdown.tsx';
import { useAutoGrow } from './composer.tsx';

export function Transcript({
  session,
  onRespond,
  onEdit,
  onFix,
}: {
  session: AgentSession;
  onRespond: (itemId: string, payload: RespondPayload) => Promise<void>;
  onEdit: (itemId: string, text: string) => Promise<void>;
  /** Sends a message asking the agent to fix what a check found. */
  onFix: (text: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const lastItem = session.items.at(-1);
  const lastText = lastItem?.kind === 'assistant' ? lastItem.text.length : 0;
  const running = session.status === 'running';
  const replies = replyTexts(session.items, running);
  // Only the newest check offers a fix; an older one was already acted on or
  // describes a file that has changed since.
  const lastCheckId = [...session.items].reverse().find((i) => i.kind === 'check')?.id;

  // Follow the stream while the user is parked at the bottom; stop once they
  // scroll up to read. `lastItem` too: a check that finishes grows in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run as the transcript grows
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [session.items.length, lastText, session.status, lastItem]);

  return (
    <div
      ref={scrollRef}
      className="odf-agent-scroll"
      onScroll={(e) => {
        const node = e.currentTarget;
        stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      }}
    >
      <ol className="odf-agent-transcript">
        {toBlocks(session.items).map((block) => (
          <li key={block.key}>
            {'tools' in block ? (
              <ToolGroup tools={block.tools} />
            ) : (
              <TranscriptItem
                item={block.item}
                running={running}
                replyText={replies.get(block.item.id)}
                onRespond={(payload) => onRespond(block.item.id, payload)}
                onEdit={(text) => onEdit(block.item.id, text)}
                onFix={block.item.id === lastCheckId && !running ? onFix : undefined}
              />
            )}
          </li>
        ))}
        {running && !(lastItem?.kind === 'assistant' && lastItem.streaming) ? (
          <li>
            <Working />
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function Working() {
  const t = useT();
  return <p className="odf-agent-working odf-agent-shimmer">{t('agent.working')}</p>;
}

// One reply spans every assistant text between a user message and the turn's
// result. Its copy button sits on the last of them and copies them all.
function replyTexts(items: AgentItem[], running: boolean): Map<string, string> {
  const replies = new Map<string, string>();
  let parts: { id: string; text: string }[] = [];
  const flush = () => {
    const last = parts.at(-1);
    const text = parts
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (last && text) replies.set(last.id, text);
    parts = [];
  };
  for (const item of items) {
    if (item.kind === 'assistant') parts.push({ id: item.id, text: item.text });
    else if (item.kind === 'user' || item.kind === 'result') flush();
  }
  if (!running) flush();
  return replies;
}

function TranscriptItem({
  item,
  running,
  replyText,
  onRespond,
  onEdit,
  onFix,
}: {
  item: AgentItem;
  running: boolean;
  replyText: string | undefined;
  onRespond: (payload: RespondPayload) => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  onFix: ((text: string) => Promise<void>) | undefined;
}) {
  switch (item.kind) {
    case 'user':
      return <UserItem text={item.text} running={running} onEdit={onEdit} />;
    case 'assistant':
      if (!item.text && item.streaming) return <Working />;
      return (
        <div className="odf-agent-message">
          <AgentMarkdown text={item.text} />
          {replyText ? (
            <div className="odf-agent-actions">
              <CopyButton text={replyText} />
            </div>
          ) : null}
        </div>
      );
    case 'question':
      return <QuestionItem item={item} onRespond={onRespond} />;
    case 'error':
      return <ErrorItem text={item.text} />;
    case 'result':
      return <ResultItem item={item} />;
    case 'check':
      return <CheckItem item={item} onFix={onFix} />;
    default:
      return null;
  }
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const label = copied ? t('agent.copied') : t('agent.copy');
  return (
    <button
      type="button"
      className="odf-agent-action"
      aria-label={label}
      title={label}
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
    </button>
  );
}

function UserItem({
  text,
  running,
  onEdit,
}: {
  text: string;
  running: boolean;
  onEdit: (text: string) => Promise<void>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <UserEditor
        text={text}
        running={running}
        onCancel={() => setEditing(false)}
        onSend={onEdit}
      />
    );
  }
  return (
    <div className="odf-agent-message odf-agent-user">
      <div className="odf-agent-bubble">{text}</div>
      <div className="odf-agent-actions">
        <CopyButton text={text} />
        {!running ? (
          <button
            type="button"
            className="odf-agent-action"
            aria-label={t('agent.edit')}
            title={t('agent.edit')}
            onClick={() => setEditing(true)}
          >
            <span aria-hidden="true">✎</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UserEditor({
  text,
  running,
  onCancel,
  onSend,
}: {
  text: string;
  running: boolean;
  onCancel: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const t = useT();
  const [value, setValue] = useState(text);
  const [busy, runBusy] = useBusy();
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !running && !busy && value.trim().length > 0 && value.trim() !== text.trim();
  useAutoGrow(ref, value, 200);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const submit = async () => {
    if (canSend) await runBusy(() => onSend(value.trim()));
  };

  return (
    <div className="odf-agent-input odf-agent-editor">
      <textarea
        ref={ref}
        value={value}
        rows={1}
        aria-label={t('agent.edit')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <p className="odf-agent-hint">{t('agent.editHint')}</p>
      <div className="odf-agent-row-end">
        <button type="button" className="odf-chip" disabled={busy} onClick={onCancel}>
          {t('agent.cancel')}
        </button>
        <button
          type="button"
          className="odf-agent-button"
          disabled={!canSend}
          onClick={() => void submit()}
        >
          {t('agent.send')}
        </button>
      </div>
    </div>
  );
}

type ToolEntry = Extract<AgentItem, { kind: 'tool' }>;

type Block = { key: string; item: AgentItem } | { key: string; tools: ToolEntry[] };

function toBlocks(items: AgentItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.kind === 'tool' && last && 'tools' in last) last.tools.push(item);
    else if (item.kind === 'tool') blocks.push({ key: item.id, tools: [item] });
    else blocks.push({ key: item.id, item });
  }
  return blocks;
}

function ToolRow({ item }: { item: ToolEntry }) {
  return (
    <div className="odf-agent-tool" data-status={item.status}>
      <i
        aria-hidden="true"
        className="odf-agent-dot"
        data-tone={item.status === 'error' ? 'error' : undefined}
      />
      <span
        className={
          item.status === 'running'
            ? 'odf-agent-tool-name odf-agent-shimmer'
            : 'odf-agent-tool-name'
        }
      >
        {item.title}
      </span>
      {item.detail ? (
        <code className="odf-agent-tool-detail" title={item.detail}>
          {item.detail}
        </code>
      ) : null}
    </div>
  );
}

function ToolGroup({ tools }: { tools: ToolEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [first] = tools;
  if (tools.length === 1 && first) return <ToolRow item={first} />;
  const live = [...tools].reverse().find((tool) => tool.status === 'running');
  const failed = tools.some((tool) => tool.status === 'error');
  return (
    <div>
      <button
        type="button"
        className="odf-agent-steps"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        {t('agent.steps', {
          n: tools.length,
          unit: t(tools.length === 1 ? 'agent.stepSingular' : 'agent.stepPlural'),
        })}
        {failed ? <i aria-hidden="true" className="odf-agent-dot" data-tone="error" /> : null}
      </button>
      {open || live ? (
        <div className="odf-agent-tool-list">
          {open ? (
            tools.map((tool) => <ToolRow key={tool.id} item={tool} />)
          ) : live ? (
            <ToolRow item={live} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ErrorItem({ text }: { text: string }) {
  const t = useT();
  return (
    <div className="odf-agent-error" role="alert">
      <span className="odf-agent-eyebrow">{t('agent.error')}</span>
      <pre>{text}</pre>
    </div>
  );
}

const CHECK_SHOWN = 5;

function CheckItem({
  item,
  onFix,
}: {
  item: Extract<AgentItem, { kind: 'check' }>;
  onFix: ((text: string) => Promise<void>) | undefined;
}) {
  const t = useT();
  const [busy, runBusy] = useBusy();
  const files = item.frameIds.join(', ');

  if (item.status === 'running') {
    return (
      <p className="odf-agent-note odf-agent-shimmer" data-agent-check>
        {t('agent.checkRunning')}
      </p>
    );
  }
  if (item.status === 'failed') {
    return (
      <p className="odf-agent-note" data-agent-check>
        {t('agent.checkFailed')}
        {item.error && item.error !== 'interrupted' ? (
          <code className="odf-agent-note-detail">{item.error}</code>
        ) : null}
      </p>
    );
  }
  const notDrawn = item.rendered ? null : (
    <span className="odf-agent-hint">{t('agent.checkNotDrawn')}</span>
  );
  if (item.total === 0) {
    return (
      <p className="odf-agent-note" data-agent-check>
        ✓ {t('agent.checkClean', { files })}
        {notDrawn}
      </p>
    );
  }

  const shown = item.findings.slice(0, CHECK_SHOWN);
  const hidden = item.total - shown.length;
  return (
    <div className="odf-agent-card" data-agent-check>
      <p className="odf-agent-card-title">
        {t('agent.checkFound', {
          n: item.total,
          unit: t(item.total === 1 ? 'agent.problemSingular' : 'agent.problemPlural'),
          files,
        })}
      </p>
      <ul className="odf-agent-findings">
        {shown.map((f, n) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed report, never reordered
          <li key={n}>
            <i
              aria-hidden="true"
              className="odf-agent-dot odf-agent-finding-dot"
              data-tone={f.severity === 'error' ? 'error' : undefined}
            />
            <span>
              {f.frame || item.frameIds.length > 1 ? (
                <code className="odf-agent-finding-where">
                  {[item.frameIds.length > 1 ? f.frameId : null, f.frame]
                    .filter(Boolean)
                    .join(' · ')}
                </code>
              ) : null}
              {f.message}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="odf-agent-hint">{t('agent.checkMore', { n: hidden })}</p> : null}
      {notDrawn}
      {onFix ? (
        <div className="odf-agent-row-end">
          <button
            type="button"
            className="odf-agent-button"
            disabled={busy}
            onClick={() => runBusy(() => onFix(checkFixPrompt(item.findings, item.total)))}
          >
            {t('agent.checkFix')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ResultItem({ item }: { item: Extract<AgentItem, { kind: 'result' }> }) {
  const t = useT();
  const parts = [item.aborted ? t('agent.resultStopped') : t('agent.resultDone')];
  if (item.durationMs !== null) {
    parts.push(t('agent.resultSeconds', { n: Math.max(1, Math.round(item.durationMs / 1000)) }));
  }
  if (item.costUsd !== null && item.costUsd > 0) parts.push(`$${item.costUsd.toFixed(2)}`);
  return <p className="odf-agent-result">{parts.join(' · ')}</p>;
}

function QuestionItem({
  item,
  onRespond,
}: {
  item: Extract<AgentItem, { kind: 'question' }>;
  onRespond: (payload: RespondPayload) => Promise<void>;
}) {
  const t = useT();
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [busy, runBusy] = useBusy();

  const answerFor = (q: AgentQuestion): string | null => {
    const custom = other[q.question]?.trim();
    const parts = [...(picked[q.question] ?? []), ...(custom ? [custom] : [])];
    return parts.length ? parts.join(', ') : null;
  };
  const complete = item.questions.every((q) => answerFor(q) !== null);
  const reply = (payload: RespondPayload) => runBusy(() => onRespond(payload));
  const submit = () => {
    const answers: Record<string, string> = {};
    for (const q of item.questions) answers[q.question] = answerFor(q) ?? '';
    void reply({ answers });
  };
  const toggle = (q: AgentQuestion, label: string) =>
    setPicked((prev) => {
      const current = prev[q.question] ?? [];
      const on = current.includes(label);
      const next = q.multiSelect
        ? on
          ? current.filter((l) => l !== label)
          : [...current, label]
        : on
          ? []
          : [label];
      return { ...prev, [q.question]: next };
    });

  if (item.status !== 'pending') {
    return (
      <div className="odf-agent-answers">
        {item.questions.map((q) => (
          <p key={q.question}>
            <span>{q.header || q.question}</span>
            <b>
              {item.status === 'answered'
                ? item.answers?.[q.question] || '—'
                : t('agent.questionSkipped')}
            </b>
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="odf-agent-card odf-agent-questions">
      {item.questions.map((q) => (
        <fieldset key={q.question}>
          <legend>{q.question}</legend>
          {q.options.map((option) => {
            const selected = (picked[q.question] ?? []).includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                className="odf-agent-option"
                data-multi={q.multiSelect || undefined}
                aria-pressed={selected}
                onClick={() => toggle(q, option.label)}
              >
                <i aria-hidden="true" className="odf-agent-check">
                  {selected ? '✓' : ''}
                </i>
                <span>
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </button>
            );
          })}
          <input
            value={other[q.question] ?? ''}
            onChange={(e) => setOther((prev) => ({ ...prev, [q.question]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && complete && !busy) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t('agent.questionOther')}
            aria-label={t('agent.questionOther')}
          />
        </fieldset>
      ))}
      <div className="odf-agent-row-end">
        <button
          type="button"
          className="odf-chip"
          disabled={busy}
          onClick={() => reply({ cancel: true })}
        >
          {t('agent.questionSkip')}
        </button>
        <button
          type="button"
          className="odf-agent-button"
          disabled={busy || !complete}
          onClick={submit}
        >
          {t('agent.questionSubmit')}
        </button>
      </div>
    </div>
  );
}
