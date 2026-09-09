import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeSheet } from '../components/theme-sheet.tsx';
import { mergeDesign } from '../lib/design.ts';
import { type LoadedTheme, themeDoc, themeImport, themeName, useThemes } from '../lib/themes.ts';

function ThemeCard({ theme }: { theme: LoadedTheme }) {
  const [copied, setCopied] = useState(false);

  if ('error' in theme) {
    return (
      <div className="odf-card odf-card-broken">
        <span className="odf-cover odf-cover-broken">{theme.error}</span>
        <span className="odf-card-name">{theme.id}</span>
      </div>
    );
  }

  const design = mergeDesign(theme.design);
  return (
    <div className="odf-card">
      <Link className="odf-card-open" to={`/themes/${theme.id}`}>
        <span className="odf-cover">
          <ThemeSheet design={design} variant="card" />
        </span>
        <span className="odf-card-name">{themeName(theme)}</span>
        {theme.meta?.description ? (
          <span className="odf-card-desc">{theme.meta.description}</span>
        ) : null}
      </Link>
      <div className="odf-theme-foot">
        <span className="odf-card-meta">
          {themeDoc(theme.id) !== null ? 'DESIGN.md' : 'No DESIGN.md yet'}
        </span>
        <button
          type="button"
          className="odf-chip"
          onClick={() => {
            void navigator.clipboard.writeText(themeImport(theme.id));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? 'Copied' : 'Copy import'}
        </button>
      </div>
      <div className="odf-theme-swatches">
        {Object.entries(design.palette).map(([name, value]) =>
          value === undefined ? null : (
            <span key={name} className="odf-theme-swatch" title={`${name} · ${value}`}>
              <i style={{ background: value }} />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function Themes() {
  const { themes, loading } = useThemes();
  const sorted = useMemo(
    () => [...themes].sort((a, b) => themeName(a).localeCompare(themeName(b))),
    [themes],
  );

  return (
    <main className="odf-home">
      <header className="odf-home-head">
        <h1>
          <span aria-hidden="true">◍</span> Themes <em>{String(themes.length).padStart(2, '0')}</em>
        </h1>
      </header>

      {loading ? null : themes.length === 0 ? (
        <p className="odf-empty">
          No themes yet. Create <code>themes/&lt;name&gt;.ts</code> that default-exports a{' '}
          <code>DesignSystem</code>, then <code>export const design</code> from a frame to use it.
        </p>
      ) : (
        <div className="odf-grid">
          {sorted.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      )}
    </main>
  );
}
