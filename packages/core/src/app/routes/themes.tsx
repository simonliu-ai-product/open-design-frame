import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeSheet } from '../components/theme-sheet.tsx';
import { mergeDesign } from '../lib/design.ts';
import { type LoadedTheme, themeDoc, themeImport, themeName, useThemes } from '../lib/themes.ts';

function ThemeCard({ theme }: { theme: LoadedTheme }) {
  const [copied, setCopied] = useState(false);

  if ('error' in theme) {
    return (
      <div className="of-card of-card-broken">
        <span className="of-cover of-cover-broken">{theme.error}</span>
        <span className="of-card-name">{theme.id}</span>
      </div>
    );
  }

  const design = mergeDesign(theme.design);
  return (
    <div className="of-card">
      <Link className="of-card-open" to={`/themes/${theme.id}`}>
        <span className="of-cover">
          <ThemeSheet design={design} variant="card" />
        </span>
        <span className="of-card-name">{themeName(theme)}</span>
        {theme.meta?.description ? (
          <span className="of-card-desc">{theme.meta.description}</span>
        ) : null}
      </Link>
      <div className="of-theme-foot">
        <span className="of-card-meta">
          {themeDoc(theme.id) !== null ? 'DESIGN.md' : 'No DESIGN.md yet'}
        </span>
        <button
          type="button"
          className="of-chip"
          onClick={() => {
            void navigator.clipboard.writeText(themeImport(theme.id));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? 'Copied' : 'Copy import'}
        </button>
      </div>
      <div className="of-theme-swatches">
        {Object.entries(design.palette).map(([name, value]) =>
          value === undefined ? null : (
            <span key={name} className="of-theme-swatch" title={`${name} · ${value}`}>
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
    <main className="of-home">
      <header className="of-home-head">
        <h1>
          <span aria-hidden="true">◍</span> Themes <em>{String(themes.length).padStart(2, '0')}</em>
        </h1>
      </header>

      {loading ? null : themes.length === 0 ? (
        <p className="of-empty">
          No themes yet. Create <code>themes/&lt;name&gt;.ts</code> that default-exports a{' '}
          <code>DesignSystem</code>, then <code>export const design</code> from a frame to use it.
        </p>
      ) : (
        <div className="of-grid">
          {sorted.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      )}
    </main>
  );
}
