import { LOC_ATTR } from '../../editing/loc.ts';
import type { ChangeHunk, FrameChanges, RevisionItem } from '../lib/changes.ts';
import { useT } from '../lib/i18n.tsx';

export type ChangesPanelProps = {
  changes: FrameChanges | null;
  revisions: RevisionItem[];
  against: string;
  loading: boolean;
  error: string | null;
  activeHunkId: string | null;
  host: HTMLElement | null;
  onChangeAgainst: (rev: string) => void;
  onSelectHunk: (hunkId: string, el: HTMLElement | null) => void;
  onRevert: (hunkId: string) => Promise<boolean>;
  onClose: () => void;
};

export function ChangesPanel({
  changes,
  revisions,
  against,
  loading,
  error,
  activeHunkId,
  host,
  onChangeAgainst,
  onSelectHunk,
  onRevert,
  onClose,
}: ChangesPanelProps) {
  const t = useT();
  const hunks = changes?.hunks ?? [];

  const selectHunk = (h: ChangeHunk) => {
    const el = h.loc && host ? host.querySelector<HTMLElement>(`[${LOC_ATTR}="${h.loc}"]`) : null;
    onSelectHunk(h.id, el);
  };

  return (
    <div className="odf-panel">
      <header className="odf-panel-head">
        <span className="odf-panel-title">
          {t('changes.title')}
          {hunks.length > 0 ? <code>{hunks.length}</code> : null}
        </span>
        <button type="button" className="odf-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="odf-panel-body odf-panel-pad">
        <div className="odf-field" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="odf-field-label">{t('changes.against')}</span>
          <span className="odf-field-value odf-field-edit" style={{ flex: 1 }}>
            <select
              className="odf-select"
              style={{ width: '100%' }}
              aria-label={t('changes.against')}
              value={against}
              onChange={(e) => onChangeAgainst(e.target.value)}
            >
              <option value="">{t('changes.workingTree')}</option>
              {revisions.map((r) => (
                <option key={r.sha} value={r.sha}>
                  {r.short} · {r.subject.slice(0, 28)}
                </option>
              ))}
            </select>
          </span>
        </div>

        {error ? <p className="odf-error odf-error-inline">{error}</p> : null}

        {hunks.length === 0 ? (
          <p className="odf-note" style={{ margin: '14px 0' }}>
            {t('changes.clean')}
          </p>
        ) : (
          <div className="odf-hunk-list">
            {hunks.map((h) => {
              const active = h.id === activeHunkId;
              const delBlock = h.removed
                .slice(0, 3)
                .map((line) => `- ${line.trim()}`)
                .join('\n');
              const addBlock = h.added
                .slice(0, 3)
                .map((line) => `+ ${line.trim()}`)
                .join('\n');
              return (
                <div key={h.id} className={active ? 'odf-hunk odf-hunk-active' : 'odf-hunk'}>
                  <div className="odf-hunk-head">
                    <button type="button" className="odf-hunk-select" onClick={() => selectHunk(h)}>
                      <span className="odf-hunk-summary">
                        {h.tagName ? <code>&lt;{h.tagName}&gt;</code> : <code>{h.file}</code>}{' '}
                        <span>:{h.newStart}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="odf-chip odf-hunk-revert"
                      disabled={loading}
                      onClick={() => void onRevert(h.id)}
                    >
                      {loading ? t('changes.reverting') : t('changes.revert')}
                    </button>
                  </div>
                  <div className="odf-hunk-desc">{h.summary}</div>
                  <pre className="odf-hunk-diff">
                    {delBlock ? <span className="odf-diff-del">{delBlock}</span> : null}
                    {addBlock ? <span className="odf-diff-add">{addBlock}</span> : null}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
