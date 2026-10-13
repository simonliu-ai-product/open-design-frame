import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n.tsx';
import type { CommentTarget } from './comment-dock.tsx';

export type CommentFormProps = {
  target: CommentTarget;
  autoFocusTrigger?: number;
  onAdd: (line: number, column: number, note: string) => Promise<boolean>;
};

/**
 * Leave a comment on what is selected.
 *
 * It sits in the Inspect panel because that is where the selection already is:
 * the note is attached to the element the rest of the panel is describing, and
 * the source it is written into is the same file the panel edits.
 */
export function CommentForm({ target, autoFocusTrigger = 0, onAdd }: CommentFormProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      field.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (autoFocusTrigger > 0) {
      field.current?.focus({ preventScroll: false });
    }
  }, [autoFocusTrigger]);

  const submit = async () => {
    if (draft.trim() === '') return;
    setBusy(true);
    try {
      if (await onAdd(target.line, target.column, draft)) setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="odf-section-label">{t('comments.add')}</div>
      <textarea
        ref={field}
        className="odf-textarea"
        value={draft}
        placeholder={t('comments.placeholder')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="odf-comment-foot">
        <button
          type="button"
          className="odf-primary odf-comment-add"
          disabled={busy || draft.trim() === ''}
          onClick={() => void submit()}
        >
          {busy ? '…' : t('comments.add')}
        </button>
        <span className="odf-comment-hint">⌘/ · ⌘↵</span>
      </div>
    </>
  );
}
