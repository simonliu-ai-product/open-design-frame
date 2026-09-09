import { frameIds } from 'virtual:open-design-frame/frames';
import { themeIds } from 'virtual:open-design-frame/themes';
import { useEffect, useMemo, useState } from 'react';
import {
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router-dom';
import { Finder } from '../components/finder.tsx';
import { Menu } from '../components/menu.tsx';
import type { Asset } from '../lib/assets.ts';
import { fetchAssets } from '../lib/assets.ts';
import { useChromeTheme } from '../lib/chrome-theme.ts';
import type { FoldersManifest } from '../lib/folders.ts';
import { useFolders } from '../lib/folders.ts';

export const UNFILED = 'Unfiled';

export type HomeContext = {
  manifest: FoldersManifest;
  editable: boolean;
  assign: (frameId: string, folderId: string | null) => Promise<boolean>;
  /** null for every frame, 'unfiled', or a folder id. */
  folderFilter: string | null;
  assets: Asset[];
  reloadAssets: () => void;
};

export function useHome(): HomeContext {
  return useOutletContext<HomeContext>();
}

/**
 * One sidebar for every page that is not a canvas.
 *
 * Frames, themes and assets are three views of one project, so the nav that
 * counts them belongs above all three rather than being drawn again per page
 * with its own idea of what is selected.
 */
export function HomeShell() {
  const { manifest, error, editable, create, rename, remove, assign } = useFolders();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTick, setAssetTick] = useState(0);
  const [finding, setFinding] = useState(false);
  const [theme, toggleTheme] = useChromeTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    void fetchAssets().then((loaded) => {
      if (!cancelled) setAssets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (assetTick === 0) return;
    let cancelled = false;
    void fetchAssets().then((loaded) => {
      if (!cancelled) setAssets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [assetTick]);

  // ⌘K anywhere, the way every other tool in the row does it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFinding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onFrames = location.pathname === '/';
  const folderFilter = onFrames ? params.get('f') : null;

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    let unfiled = 0;
    for (const id of frameIds) {
      const folderId = manifest.assignments[id];
      if (folderId) byFolder.set(folderId, (byFolder.get(folderId) ?? 0) + 1);
      else unfiled += 1;
    }
    return { byFolder, unfiled };
  }, [manifest]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const go = (to: string) => navigate(to);

  const submitNewFolder = async () => {
    if (draft.trim() === '') {
      setCreating(false);
      return;
    }
    if (await create(draft)) {
      setDraft('');
      setCreating(false);
    }
  };

  return (
    <div className="odf-home-shell">
      <aside className="odf-nav">
        <div className="odf-nav-top">
          <span className="odf-nav-brand">open-design-frame</span>
          <button
            type="button"
            className="odf-nav-icon"
            aria-label="Search"
            title="Search (⌘K)"
            onClick={() => setFinding(true)}
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
          </button>
          <button
            type="button"
            className="odf-nav-icon"
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-pressed={theme === 'light'}
            title={theme === 'dark' ? 'Light chrome' : 'Dark chrome'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 .8v2M8 13.2v2M.8 8h2M13.2 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
        <nav className="odf-nav-list">
          <button
            type="button"
            className="odf-nav-item"
            aria-current={onFrames && folderFilter === null}
            onClick={() => go('/')}
          >
            <i>▦</i> All frames <b>{pad(frameIds.length)}</b>
          </button>
          <button
            type="button"
            className="odf-nav-item"
            aria-current={location.pathname === '/themes'}
            onClick={() => go('/themes')}
          >
            <i>◍</i> Themes <b>{pad(themeIds.length)}</b>
          </button>
          <button
            type="button"
            className="odf-nav-item"
            aria-current={location.pathname === '/assets'}
            onClick={() => go('/assets')}
          >
            <i>▤</i> Assets <b>{pad(assets.length)}</b>
          </button>
        </nav>

        <div className="odf-nav-label">Folders</div>
        <nav className="odf-nav-list">
          <button
            type="button"
            className="odf-nav-item"
            aria-current={onFrames && folderFilter === 'unfiled'}
            onClick={() => go('/?f=unfiled')}
          >
            <i>▢</i> {UNFILED} <b>{pad(counts.unfiled)}</b>
          </button>

          {manifest.folders.map((folder) =>
            renaming === folder.id ? (
              <input
                key={folder.id}
                className="odf-nav-input"
                // biome-ignore lint/a11y/noAutofocus: the field replaces the row the user just chose
                autoFocus
                defaultValue={folder.name}
                aria-label="Folder name"
                onBlur={(e) => {
                  void rename(folder.id, e.target.value);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <span className="odf-nav-row" key={folder.id}>
                <button
                  type="button"
                  className="odf-nav-item"
                  aria-current={onFrames && folderFilter === folder.id}
                  onClick={() => go(`/?f=${encodeURIComponent(folder.id)}`)}
                >
                  <i>▥</i> {folder.name} <b>{pad(counts.byFolder.get(folder.id) ?? 0)}</b>
                </button>
                {editable ? (
                  <Menu
                    label={`Actions for ${folder.name}`}
                    items={[
                      {
                        key: 'rename',
                        label: 'Rename',
                        icon: '✎',
                        onSelect: () => setRenaming(folder.id),
                      },
                      {
                        key: 'delete',
                        label: 'Delete',
                        icon: '␡',
                        danger: true,
                        confirmLabel: 'Delete folder?',
                        onSelect: () => {
                          if (folderFilter === folder.id) go('/');
                          void remove(folder.id);
                        },
                      },
                    ]}
                  />
                ) : null}
              </span>
            ),
          )}

          {creating ? (
            <input
              className="odf-nav-input"
              // biome-ignore lint/a11y/noAutofocus: the field is what New folder just opened
              autoFocus
              value={draft}
              placeholder="Folder name"
              aria-label="New folder name"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void submitNewFolder()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
          ) : editable ? (
            <button
              type="button"
              className="odf-nav-item odf-nav-new"
              onClick={() => {
                setCreating(true);
                setDraft('');
              }}
            >
              <i>＋</i> New folder
            </button>
          ) : null}
        </nav>

        {error ? <p className="odf-error odf-error-inline">{error}</p> : null}
        <span className="odf-nav-spacer" />
        <div className="odf-nav-foot">
          <i className="odf-dot" /> v0.1.0
        </div>
      </aside>

      {finding ? <Finder manifest={manifest} onClose={() => setFinding(false)} /> : null}

      <Outlet
        context={
          {
            manifest,
            editable,
            assign,
            folderFilter,
            assets,
            reloadAssets: () => setAssetTick((n) => n + 1),
          } satisfies HomeContext
        }
      />
    </div>
  );
}
