import { type ReactNode, type RefObject, useLayoutEffect } from 'react';
import { useT } from '../../lib/i18n.tsx';

export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  max: number,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the value is what changes the height
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, max)}px`;
  }, [ref, value, max]);
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  running,
  busy,
  placeholder,
  chips,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  busy: boolean;
  placeholder: string;
  chips?: ReactNode;
  textareaRef: RefObject<HTMLTextAreaElement>;
}) {
  const t = useT();
  const canSend = !running && !busy && value.trim().length > 0;
  useAutoGrow(textareaRef, value, 160);

  return (
    <div className="odf-agent-composer">
      <div className="odf-agent-input">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
        />
        <div className="odf-agent-input-foot">
          <div className="odf-agent-chips">{chips}</div>
          {running ? (
            <button
              type="button"
              className="odf-agent-send odf-agent-stop"
              aria-label={t('agent.stop')}
              title={t('agent.stop')}
              onClick={onStop}
            >
              <span aria-hidden="true">■</span>
            </button>
          ) : (
            <button
              type="button"
              className="odf-agent-send"
              aria-label={t('agent.send')}
              title={t('agent.send')}
              disabled={!canSend}
              onClick={onSend}
            >
              <span aria-hidden="true">↑</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContextChip({
  children,
  tone = 'default',
  onClick,
  title,
}: {
  children: ReactNode;
  tone?: 'default' | 'accent';
  onClick?: () => void;
  title?: string;
}) {
  const className = tone === 'accent' ? 'odf-agent-chip odf-agent-chip-accent' : 'odf-agent-chip';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={className}>
        <span className="odf-agent-chip-text">{children}</span>
      </button>
    );
  }
  return (
    <span title={title} className={className}>
      <span className="odf-agent-chip-text">{children}</span>
    </span>
  );
}
