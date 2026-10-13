import { frameIds, loadFrame } from 'virtual:open-design-frame/frames';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FrameCanvas } from '../components/frame-canvas.tsx';
import { Menu, type MenuItem } from '../components/menu.tsx';
import { mergeDesign } from '../lib/design.ts';
import { deleteFrame, duplicateFrame, renameFrame } from '../lib/frames.ts';
import { useT } from '../lib/i18n.tsx';
import { type Frame, type FrameModule, nameOf, sizeOf } from '../lib/sdk.ts';
import { UNFILED, useHome } from './home-shell.tsx';

type Loaded = { id: string; mod: FrameModule } | { id: string; error: string };
type SortKey = 'newest' | 'name';

const titleOf = (file: Loaded): string =>
  'error' in file ? file.id : (file.mod.meta?.title ?? file.id);

function Cover({ frame, design }: { frame: Frame; design: ReturnType<typeof mergeDesign> }) {
  const Component = frame;
  return (
    <span className="odf-cover">
      <FrameCanvas size={sizeOf(frame)} design={design} flat>
        <Component />
      </FrameCanvas>
    </span>
  );
}

export function Home() {
  const [files, setFiles] = useState<Loaded[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [renamingFrame, setRenamingFrame] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { manifest, editable, assign, folderFilter } = useHome();
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      frameIds.map(async (id): Promise<Loaded> => {
        try {
          const mod = (await loadFrame(id)) as FrameModule;
          if (!Array.isArray(mod.default) || mod.default.length === 0) {
            return { id, error: 'exports no frames' };
          }
          return { id, mod };
        } catch (err) {
          return { id, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    ).then((loaded) => {
      if (!cancelled) setFiles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const viewName =
    folderFilter === null
      ? t('home.frames')
      : folderFilter === 'unfiled'
        ? t('nav.unfiled')
        : (manifest.folders.find((f) => f.id === folderFilter)?.name ?? UNFILED);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let matched = needle
      ? files.filter((f) => `${f.id} ${titleOf(f)}`.toLowerCase().includes(needle))
      : files;
    if (folderFilter === 'unfiled') {
      matched = matched.filter((f) => manifest.assignments[f.id] === undefined);
    } else if (folderFilter !== null) {
      matched = matched.filter((f) => manifest.assignments[f.id] === folderFilter);
    }
    if (sort === 'name') return [...matched].sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    const at = (f: Loaded) => ('error' in f ? 0 : Date.parse(f.mod.meta?.createdAt ?? '') || 0);
    return [...matched].sort((a, b) => at(b) - at(a));
  }, [files, query, sort, folderFilter, manifest]);

  const run = async (work: Promise<string | null>) => {
    const failed = await work;
    setFailure(failed);
  };

  const cardMenu = (id: string): MenuItem[] => [
    { key: 'rename', label: t('home.rename'), icon: '✎', onSelect: () => setRenamingFrame(id) },
    {
      key: 'duplicate',
      label: t('home.duplicate'),
      icon: '⧉',
      onSelect: () => void run(duplicateFrame(id)),
    },
    {
      key: 'move',
      label: t('home.moveToFolder'),
      icon: '⇥',
      submenu: [
        {
          key: 'unfiled',
          label: t('nav.unfiled'),
          current: manifest.assignments[id] === undefined,
          onSelect: () => void assign(id, null),
        },
        ...manifest.folders.map((folder) => ({
          key: folder.id,
          label: folder.name,
          current: manifest.assignments[id] === folder.id,
          onSelect: () => void assign(id, folder.id),
        })),
      ],
    },
    {
      key: 'delete',
      label: t('home.delete'),
      icon: '␡',
      danger: true,
      confirmLabel: `Delete frames/${id}?`,
      onSelect: () => void run(deleteFrame(id)),
    },
  ];

  return (
    <main className="odf-home">
      <header className="odf-home-head">
        <h1>
          <span aria-hidden="true">▦</span> {viewName}{' '}
          <em>{String(shown.length).padStart(2, '0')}</em>
        </h1>
        <div className="odf-home-tools">
          <label className="odf-sort">
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="newest">{t('home.newest')}</option>
              <option value="name">{t('home.name')}</option>
            </select>
          </label>
          <label className="odf-search">
            <span className="odf-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              placeholder={t('home.searchFrames')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </header>

      {failure ? <p className="odf-error odf-error-inline">{failure}</p> : null}

      {frameIds.length === 0 ? (
        <p className="odf-empty">{t('home.emptyNoFrames')}</p>
      ) : shown.length === 0 ? (
        <p className="odf-empty">{t('home.emptyFolder', { name: viewName })}</p>
      ) : (
        <div className="odf-grid">
          {shown.map((file) => {
            if ('error' in file) {
              return (
                <div className="odf-card odf-card-broken" key={file.id}>
                  <span className="odf-cover odf-cover-broken">{file.error}</span>
                  <span className="odf-card-name">{file.id}</span>
                </div>
              );
            }
            const first = file.mod.default[0];
            if (!first) return null;
            const count = file.mod.default.length;
            return (
              <div className="odf-card" key={file.id}>
                <Link className="odf-card-open" to={`/f/${file.id}`}>
                  <Cover frame={first} design={mergeDesign(file.mod.design)} />
                </Link>
                {editable ? (
                  <Menu
                    className="odf-card-menu"
                    label={`Actions for ${titleOf(file)}`}
                    items={cardMenu(file.id)}
                  />
                ) : null}
                {renamingFrame === file.id ? (
                  <input
                    className="odf-card-input"
                    // biome-ignore lint/a11y/noAutofocus: the field replaces the name the user just chose to change
                    autoFocus
                    defaultValue={titleOf(file)}
                    aria-label="Frame name"
                    onBlur={(e) => {
                      void run(renameFrame(file.id, e.target.value));
                      setRenamingFrame(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenamingFrame(null);
                    }}
                  />
                ) : (
                  <Link className="odf-card-open" to={`/f/${file.id}`}>
                    <span className="odf-card-name">{titleOf(file)}</span>
                    <span className="odf-card-meta">
                      {nameOf(first, 0)} · {count}{' '}
                      {count === 1 ? t('home.frameSingular') : t('home.framePlural')}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
