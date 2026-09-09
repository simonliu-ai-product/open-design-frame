import { useEffect, useRef, useState } from 'react';
import type { FrameComment } from '../lib/comments.ts';

export type CommentTarget = { line: number; column: number; label: string };

export type CommentDockProps = {
  comments: FrameComment[];
  error: string | null;
  onRemove: (id: string) => void;
};

/**
 * The notes on this frame, and how many.
 *
 * The list only; a note is written from the Inspect panel, where the element it
 * is about is already selected. A composer here as well would be a second place
 * to say the same thing, with its own idea of what it is attached to.
 */
export function CommentDock({ comments, error, onRemove }: CommentDockProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="odf-comments" ref={ref}>
      {open ? (
        <div className="odf-comments-panel">
          <header className="odf-comments-head">
            <span>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
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
            <p className="odf-note odf-comments-empty">
              No notes on this frame yet. Select something and leave one in the Inspect panel.
            </p>
          ) : (
            <ul className="odf-comment-list">
              {comments.map((comment) => (
                <li key={comment.id} className="odf-comment">
                  <span className="odf-comment-line">line {comment.line}</span>
                  <p className="odf-comment-note">{comment.note}</p>
                  <button
                    type="button"
                    className="odf-comment-remove"
                    aria-label={`Delete comment on line ${comment.line}`}
                    onClick={() => onRemove(comment.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="odf-comments-bubble"
        aria-expanded={open}
        aria-label={`${comments.length} comments`}
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
  );
}
