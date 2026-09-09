import { useEffect, useRef, useState } from 'react';
import type { CommentTarget } from './comment-dock.tsx';

export type CommentFormProps = {
  target: CommentTarget;
  onAdd: (line: number, column: number, note: string) => Promise<boolean>;
};

/**
 * Leave a comment on what is selected.
 *
 * It sits in the Inspect panel because that is where the selection already is:
 * the note is attached to the element the rest of the panel is describing, and
 * the source it is written into is the same file the panel edits.
 */
export function CommentForm({ target, onAdd }: CommentFormProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      field.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      <div className="of-section-label">Leave a comment</div>
      <textarea
        ref={field}
        className="of-textarea"
        value={draft}
        placeholder="Describe a change for the agent…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="of-comment-foot">
        <span className="of-comment-hint">⌘/ to focus · ⌘↵ to add</span>
        <button
          type="button"
          className="of-primary of-comment-add"
          disabled={busy || draft.trim() === ''}
          onClick={() => void submit()}
        >
          {busy ? 'Adding…' : 'Add comment'}
        </button>
      </div>
    </>
  );
}
