import { frameIds } from 'virtual:open-design-frame/frames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChromeTheme } from '../lib/chrome-theme.ts';
import type { FoldersManifest } from '../lib/folders.ts';
import { LOCALES, useLocale, useT } from '../lib/i18n.tsx';
import { type Frame, nameOf } from '../lib/sdk.ts';
import { themeName, useThemes } from '../lib/themes.ts';

export type FinderAction = {
  key: string;
  label: string;
  run: () => void;
};

export type FinderProps = {
  manifest?: FoldersManifest;
  artboards?: Frame[];
  onSelectArtboard?: (index: number) => void;
  actions?: FinderAction[];
  onClose: () => void;
};

type Hit = {
  key: string;
  kind: string;
  label: string;
  to?: string;
  run?: () => void;
};

/**
 * Jump to anything by name or execute a canvas/chrome command (⌘K).
 */
export function Finder({
  manifest,
  artboards = [],
  onSelectArtboard,
  actions = [],
  onClose,
}: FinderProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { themes } = useThemes();
  const [, toggleTheme] = useChromeTheme();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const all: Hit[] = [
      ...artboards.map((frame, i) => ({
        key: `a:${i}`,
        kind: t('finder.kindArtboard'),
        label: `${String(i + 1).padStart(2, '0')} · ${nameOf(frame, i)}`,
        run: () => onSelectArtboard?.(i),
      })),
      ...actions.map((act) => ({
        key: `act:${act.key}`,
        kind: t('finder.kindAction'),
        label: act.label,
        run: act.run,
      })),
      ...frameIds.map((id) => ({
        key: `f:${id}`,
        kind: t('finder.kindFrame'),
        label: id,
        to: `/f/${id}`,
      })),
      ...themes.map((theme) => ({
        key: `t:${theme.id}`,
        kind: t('finder.kindTheme'),
        label: themeName(theme),
        to: `/themes/${theme.id}`,
      })),
      ...(manifest?.folders ?? []).map((folder) => ({
        key: `d:${folder.id}`,
        kind: t('finder.kindFolder'),
        label: folder.name,
        to: `/?f=${encodeURIComponent(folder.id)}`,
      })),
      { key: 'p:frames', kind: t('finder.kindPage'), label: t('nav.allFrames'), to: '/' },
      { key: 'p:themes', kind: t('finder.kindPage'), label: t('nav.themes'), to: '/themes' },
      { key: 'p:assets', kind: t('finder.kindPage'), label: t('nav.assets'), to: '/assets' },
      {
        key: 'act:chrome-theme',
        kind: t('finder.kindAction'),
        label: t('finder.toggleChromeTheme'),
        run: () => toggleTheme(),
      },
      ...LOCALES.filter((l) => l.code !== locale).map((l) => ({
        key: `lang:${l.code}`,
        kind: t('nav.language'),
        label: `${t('nav.language')}: ${l.label}`,
        run: () => setLocale(l.code),
      })),
    ];
    const needle = query.trim().toLowerCase();
    return needle === ''
      ? all
      : all.filter((hit) => `${hit.label} ${hit.kind}`.toLowerCase().includes(needle));
  }, [
    query,
    artboards,
    actions,
    themes,
    manifest,
    locale,
    t,
    onSelectArtboard,
    toggleTheme,
    setLocale,
  ]);

  useEffect(() => setActive(0), []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [onClose]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onClose();
    if (hit.run) hit.run();
    else if (hit.to) navigate(hit.to);
  };

  return (
    <div className="odf-finder">
      <div className="odf-finder-box" ref={box}>
        <input
          className="odf-finder-input"
          // biome-ignore lint/a11y/noAutofocus: the field is the whole point of the dialog
          autoFocus
          value={query}
          placeholder={t('finder.placeholder')}
          aria-label={t('nav.search')}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') go(hits[active]);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(hits.length - 1, i + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
          }}
        />
        <div className="odf-finder-list">
          {hits.length === 0 ? (
            <p className="odf-note">{t('finder.empty')}</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.key}
                type="button"
                className="odf-finder-hit"
                aria-current={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => go(hit)}
              >
                <span className="odf-finder-kind">{hit.kind}</span>
                {hit.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
