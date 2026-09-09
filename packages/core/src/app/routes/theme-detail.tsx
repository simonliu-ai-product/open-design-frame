import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Markdown } from '../components/markdown.tsx';
import { ThemeSheet } from '../components/theme-sheet.tsx';
import { mergeDesign } from '../lib/design.ts';
import { createThemeDoc, themeDoc, themeName, useThemes } from '../lib/themes.ts';

export function ThemeDetail() {
  const { themeId = '' } = useParams();
  const { themes, loading } = useThemes();
  const theme = themes.find((t) => t.id === themeId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const doc = themeDoc(themeId);

  if (loading) return <main className="odf-home" />;
  if (!theme) {
    return (
      <main className="odf-home">
        <p className="odf-empty">
          No theme named <code>{themeId}</code>. It would be <code>themes/{themeId}.ts</code> or{' '}
          <code>themes/{themeId}/index.ts</code>.
        </p>
      </main>
    );
  }
  if ('error' in theme) {
    return (
      <main className="odf-home">
        <p className="odf-error">{theme.error}</p>
      </main>
    );
  }

  const design = mergeDesign(theme.design);

  const generate = async () => {
    setBusy(true);
    setError(await createThemeDoc(theme.id, themeName(theme), theme.design));
    setBusy(false);
  };

  return (
    <main className="odf-home">
      <header className="odf-home-head">
        <h1>
          <Link className="odf-back" to="/themes" aria-label="All themes">
            ‹
          </Link>
          {themeName(theme)}
        </h1>
      </header>

      <ThemeSheet design={design} />

      <div className="odf-theme-detail">
        <div className="odf-theme-side">
          <div className="odf-section-label">Tokens</div>
          <div className="odf-theme-tokens">
            {Object.entries(design.palette).map(([name, value]) =>
              value === undefined ? null : (
                <span className="odf-theme-token" key={name}>
                  <i style={{ background: value }} />
                  <b>{name}</b>
                  <code>{value}</code>
                </span>
              ),
            )}
            {Object.entries(design.typeScale ?? {}).map(([name, value]) => (
              <span className="odf-theme-token" key={name}>
                <b>{name}</b>
                <code>{value}px</code>
              </span>
            ))}
            <span className="odf-theme-token">
              <b>radius</b>
              <code>{design.radius}px</code>
            </span>
          </div>

          <div className="odf-section-label">Fonts</div>
          <div className="odf-theme-tokens">
            {Object.entries(design.fonts).map(([name, value]) =>
              value === undefined ? null : (
                <span className="odf-theme-token" key={name}>
                  <b>{name}</b>
                  <code className="odf-theme-font-value">
                    {value.split(',')[0]?.replace(/["']/g, '')}
                  </code>
                </span>
              ),
            )}
          </div>
        </div>

        <div className="odf-theme-doc">
          {doc === null ? (
            <div className="odf-assets-empty">
              <span className="odf-assets-empty-mark" aria-hidden="true">
                ▤
              </span>
              <p className="odf-assets-empty-title">No DESIGN.md yet</p>
              <p className="odf-note">
                A design document is the half of a design system that tokens cannot hold — the
                atmosphere, the rules, what not to do. It lives at{' '}
                <code>themes/{theme.id}/DESIGN.md</code>, and both people and agents read it.
              </p>
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  className="odf-primary odf-theme-generate"
                  disabled={busy}
                  onClick={() => void generate()}
                >
                  {busy ? 'Writing…' : 'Start one from these tokens'}
                </button>
              ) : null}
              {error ? <p className="odf-error odf-error-inline">{error}</p> : null}
            </div>
          ) : (
            <>
              <div className="odf-doc-head">
                <code className="odf-doc-path">DESIGN.md</code>
                <button
                  type="button"
                  className="odf-chip"
                  onClick={() => {
                    void navigator.clipboard.writeText(doc);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1400);
                  }}
                >
                  {copied ? 'Copied' : 'Copy DESIGN.md'}
                </button>
              </div>
              <Markdown text={doc} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
