import { useEffect, useRef, useState } from 'react';
import { LOC_ATTR } from '../../editing/loc.ts';
import type { FrameComment } from '../lib/comments.ts';
import { useT } from '../lib/i18n.tsx';

export type CommentTarget = { line: number; column: number; label: string };

export type CommentDockProps = {
  comments: FrameComment[];
  error: string | null;
  picking?: boolean;
  host?: HTMLElement | null;
  onTogglePicking?: () => void;
  onSelectElement?: (el: HTMLElement) => void;
  onRemove: (id: string) => void;
};

/**
 * The notes on this frame, and how many, plus a one-click "+ New comment"
 * picking mode so a reviewer can pin an element directly on the canvas.
 */
export function CommentDock({
  comments,
  error,
  picking = false,
  host = null,
  onTogglePicking,
  onSelectElement,
  onRemove,
}: CommentDockProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const countLabel = t('comments.count', {
    n: comments.length,
    unit: comments.length === 1 ? t('comments.singular') : t('comments.plural'),
  });

  return (
    <div className="odf-comments" ref={ref}>
      {picking ? (
        <div className="odf-comment-picking-banner">{t('comments.pickingHint')}</div>
      ) : null}

      {open ? (
        <div className="odf-comments-panel">
          <header className="odf-comments-head">
            <span>{countLabel}</span>
            <button
              type="button"
              className="odf-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>

          {error ? <p className="odf-error odf-error-inline">{error}</p> : null}

          {comments.length === 0 ? (
            <p className="odf-note odf-comments-empty">{t('comments.empty')}</p>
          ) : (
            <ul className="odf-comment-list">
              {comments.map((comment, idx) => (
                <li
                  key={comment.id}
                  className="odf-comment"
                  onClick={() => {
                    if (!comment.loc || !host || !onSelectElement) return;
                    const el = host.querySelector<HTMLElement>(`[${LOC_ATTR}="${comment.loc}"]`);
                    if (el) onSelectElement(el);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      comment.loc &&
                      host &&
                      onSelectElement
                    ) {
                      const el = host.querySelector<HTMLElement>(`[${LOC_ATTR}="${comment.loc}"]`);
                      if (el) onSelectElement(el);
                    }
                  }}
                >
                  <span className="odf-comment-line">
                    #{idx + 1} · line {comment.line}
                  </span>
                  <p className="odf-comment-note">{comment.note}</p>
                  <button
                    type="button"
                    className="odf-comment-remove"
                    aria-label={`Delete comment on line ${comment.line}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(comment.id);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="odf-comments-actions">
        {onTogglePicking ? (
          <button
            type="button"
            className={
              picking ? 'odf-comments-bubble odf-comments-bubble-active' : 'odf-comments-bubble'
            }
            aria-pressed={picking}
            title={t('comments.newComment')}
            onClick={onTogglePicking}
          >
            ＋ {t('comments.newComment')}
          </button>
        ) : null}

        <button
          type="button"
          className="odf-comments-bubble"
          aria-expanded={open}
          aria-label={countLabel}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
            <path
              d="M2.4 2h11.2c.77 0 1.4.63 1.4 1.4v6.7c0 .77-.63 1.4-1.4 1.4H6.9l-3.3 2.6a.5.5 0 0 1-.8-.4v-2.2h-.4c-.77 0-1.4-.63-1.4-1.4V3.4C1 2.63 1.63 2 2.4 2Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
          {comments.length}
        </button>
      </div>
    </div>
  );
}
