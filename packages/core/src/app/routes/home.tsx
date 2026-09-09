import { frameIds, loadFrame } from 'virtual:open-frame/frames';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FrameCanvas } from '../components/frame-canvas.tsx';
import { Menu, type MenuItem } from '../components/menu.tsx';
import { mergeDesign } from '../lib/design.ts';
import { deleteFrame, duplicateFrame, renameFrame } from '../lib/frames.ts';
import { type Frame, type FrameModule, nameOf, sizeOf } from '../lib/sdk.ts';
import { UNFILED, useHome } from './home-shell.tsx';

type Loaded = { id: string; mod: FrameModule } | { id: string; error: string };
type SortKey = 'newest' | 'name';

const titleOf = (file: Loaded): string =>
  'error' in file ? file.id : (file.mod.meta?.title ?? file.id);

/*
 * Every card is the same size, whatever shape the frame is.
 *
 * The cover is a fixed box and the frame is fitted inside it, so a phone next
 * to a desktop letterboxes rather than making its row taller — a grid whose
 * cells are each a different height is a list of frames sorted by nothing.
 */
function Cover({ frame, design }: { frame: Frame; design: ReturnType<typeof mergeDesign> }) {
  const Component = frame;
  return (
    <span className="of-cover">
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
      ? 'Frames'
      : folderFilter === 'unfiled'
        ? UNFILED
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
    // Newest first, and a file with no timestamp sorts as old rather than as now
    // — an unset field should not outrank one somebody actually set.
    const at = (f: Loaded) => ('error' in f ? 0 : Date.parse(f.mod.meta?.createdAt ?? '') || 0);
    return [...matched].sort((a, b) => at(b) - at(a));
  }, [files, query, sort, folderFilter, manifest]);

  const run = async (work: Promise<string | null>) => {
    const failed = await work;
    setFailure(failed);
  };

  const cardMenu = (id: string): MenuItem[] => [
    { key: 'rename', label: 'Rename', icon: '✎', onSelect: () => setRenamingFrame(id) },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: '⧉',
      onSelect: () => void run(duplicateFrame(id)),
    },
    {
      key: 'move',
      label: 'Move to folder…',
      icon: '⇥',
      submenu: [
        {
          key: 'unfiled',
          label: UNFILED,
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
      label: 'Delete',
      icon: '␡',
      danger: true,
      confirmLabel: `Delete frames/${id}?`,
      onSelect: () => void run(deleteFrame(id)),
    },
  ];

  return (
    <main className="of-home">
      <header className="of-home-head">
        <h1>
          <span aria-hidden="true">▦</span> {viewName}{' '}
          <em>{String(shown.length).padStart(2, '0')}</em>
        </h1>
        <div className="of-home-tools">
          <label className="of-sort">
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label className="of-search">
            <span className="of-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              placeholder="Search frames"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </header>

      {failure ? <p className="of-error of-error-inline">{failure}</p> : null}

      {frameIds.length === 0 ? (
        <p className="of-empty">
          No frames yet. Create <code>frames/&lt;id&gt;/index.tsx</code> and export an array of
          frames from it.
        </p>
      ) : shown.length === 0 ? (
        <p className="of-empty">
          Nothing in {viewName}. Move a frame here from the ⋯ menu on its card.
        </p>
      ) : (
        <div className="of-grid">
          {shown.map((file) => {
            if ('error' in file) {
              return (
                <div className="of-card of-card-broken" key={file.id}>
                  <span className="of-cover of-cover-broken">{file.error}</span>
                  <span className="of-card-name">{file.id}</span>
                </div>
              );
            }
            const first = file.mod.default[0];
            if (!first) return null;
            const count = file.mod.default.length;
            return (
              <div className="of-card" key={file.id}>
                <Link className="of-card-open" to={`/f/${file.id}`}>
                  <Cover frame={first} design={mergeDesign(file.mod.design)} />
                </Link>
                {editable ? (
                  <Menu
                    className="of-card-menu"
                    label={`Actions for ${titleOf(file)}`}
                    items={cardMenu(file.id)}
                  />
                ) : null}
                {renamingFrame === file.id ? (
                  <input
                    className="of-card-input"
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
                  <Link className="of-card-open" to={`/f/${file.id}`}>
                    <span className="of-card-name">{titleOf(file)}</span>
                    <span className="of-card-meta">
                      {nameOf(first, 0)} · {count} {count === 1 ? 'frame' : 'frames'}
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
