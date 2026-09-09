import { frameIds } from 'virtual:open-frame/frames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FoldersManifest } from '../lib/folders.ts';
import { themeName, useThemes } from '../lib/themes.ts';

export type FinderProps = { manifest: FoldersManifest; onClose: () => void };

type Hit = { key: string; kind: string; label: string; to: string };

/**
 * Jump to anything by name.
 *
 * Only what the viewer already knows is listed — the frame ids it discovered,
 * the themes it loaded, the folders on disk. Nothing here searches inside a
 * frame, and it does not pretend to: a result that cannot be opened is worse
 * than one that was never offered.
 */
export function Finder({ manifest, onClose }: FinderProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { themes } = useThemes();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const all: Hit[] = [
      ...frameIds.map((id) => ({ key: `f:${id}`, kind: 'Frame', label: id, to: `/f/${id}` })),
      ...themes.map((theme) => ({
        key: `t:${theme.id}`,
        kind: 'Theme',
        label: themeName(theme),
        to: `/themes/${theme.id}`,
      })),
      ...manifest.folders.map((folder) => ({
        key: `d:${folder.id}`,
        kind: 'Folder',
        label: folder.name,
        to: `/?f=${encodeURIComponent(folder.id)}`,
      })),
      { key: 'p:frames', kind: 'Page', label: 'All frames', to: '/' },
      { key: 'p:themes', kind: 'Page', label: 'Themes', to: '/themes' },
      { key: 'p:assets', kind: 'Page', label: 'Assets', to: '/assets' },
    ];
    const needle = query.trim().toLowerCase();
    return needle === ''
      ? all
      : all.filter((hit) => `${hit.label} ${hit.kind}`.toLowerCase().includes(needle));
  }, [query, themes, manifest]);

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
    navigate(hit.to);
  };

  return (
    <div className="of-finder">
      <div className="of-finder-box" ref={box}>
        <input
          className="of-finder-input"
          // biome-ignore lint/a11y/noAutofocus: the field is the whole point of the dialog
          autoFocus
          value={query}
          placeholder="Go to a frame, theme or folder…"
          aria-label="Search"
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
        <div className="of-finder-list">
          {hits.length === 0 ? (
            <p className="of-note">Nothing by that name.</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.key}
                type="button"
                className="of-finder-hit"
                aria-current={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => go(hit)}
              >
                <span className="of-finder-kind">{hit.kind}</span>
                {hit.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
