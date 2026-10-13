import { frameIds, loadFrame } from 'virtual:open-design-frame/frames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CanvasPins } from '../components/canvas-pins.tsx';
import { ChangesPanel } from '../components/changes-panel.tsx';
import { CommentDock } from '../components/comment-dock.tsx';
import { ExportStage } from '../components/export-stage.tsx';
import { Finder, type FinderAction } from '../components/finder.tsx';
import { FrameCanvas } from '../components/frame-canvas.tsx';
import { FrameRail } from '../components/frame-rail.tsx';
import { InspectPanel } from '../components/inspect-panel.tsx';
import { LanguageMenu } from '../components/language-menu.tsx';
import { Player } from '../components/player.tsx';
import { Selection } from '../components/selection.tsx';
import { useChanges } from '../lib/changes.ts';
import { useComments } from '../lib/comments.ts';
import { mergeDesign } from '../lib/design.ts';
import { applyEdit, type EditOp, type Loc, locOf, reportCurrentFrame } from '../lib/editor.ts';
import { type ExportFormat, type ExportItem, exportZip, slugOf } from '../lib/export.ts';
import { useT } from '../lib/i18n.tsx';
import { collectLayers, type LayerNode } from '../lib/layers.ts';
import { labelOf, type Pick, pickAt, pickOf, resolvePick, samePick } from '../lib/pick.ts';
import { type FrameModule, nameOf, sizeOf } from '../lib/sdk.ts';

type Dock = 'inspect' | 'changes' | 'export' | null;
export type ViewMode = 'single' | 'split' | 'grid';

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function FrameView() {
  const { fileId = '' } = useParams();
  const frameFile = frameIds.includes(fileId) ? fileId : null;
  const [mod, setMod] = useState<FrameModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [splitIndex, setSplitIndex] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [dock, setDock] = useState<Dock>('inspect');
  const [playing, setPlaying] = useState(false);
  const [finding, setFinding] = useState(false);
  const [pickingComment, setPickingComment] = useState(false);
  const [commentFocusTrigger, setCommentFocusTrigger] = useState(0);
  const [activeHunkId, setActiveHunkId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [applied, setApplied] = useState(1);
  const [layers, setLayers] = useState<LayerNode[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<Map<string, { loc: Loc; ops: EditOp[] }>>(new Map());
  const [revision, setRevision] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (frameFile === null) return;
    let cancelled = false;
    setError(null);
    loadFrame(frameFile)
      .then((loaded) => {
        if (cancelled) return;
        const next = loaded as FrameModule;
        if (!Array.isArray(next.default) || next.default.length === 0) {
          setError(`frames/${frameFile} exports no frames — default must be an array.`);
          setMod(null);
          return;
        }
        setMod(next);
        setIndex(0);
        setSplitIndex(next.default.length > 1 ? 1 : 0);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [frameFile]);

  const design = useMemo(() => mergeDesign(mod?.design), [mod]);
  const frames = mod?.default ?? [];
  const frame = frames[index];
  const Current = frame;
  const SplitFrame = frames[splitIndex] ?? frames[0];
  const size = frame ? sizeOf(frame) : { width: 0, height: 0 };

  const renderedKey = `${frameFile}:${index}:${viewMode}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the trigger, not an input
  useEffect(() => {
    const host = frameRef.current;
    if (!host) return;
    setLayers(collectLayers(host));
    setSelected(pick ? resolvePick(host, pick) : null);
    setHovered(null);
  }, [renderedKey, mod, pick]);

  const select = useCallback((el: HTMLElement | null) => {
    const host = frameRef.current;
    if (!host || !el) {
      setPick(null);
      setSelected(null);
      return;
    }
    const next = pickOf(host, el);
    setPick((prev) => (samePick(prev, next) ? prev : next));
    setSelected(el);
  }, []);

  // Report current frame & selection to `/__current` so CLI and MCP tools know what is active.
  useEffect(() => {
    if (!frameFile) return;
    const loc = selected ? locOf(selected) : null;
    void reportCurrentFrame({
      frameId: frameFile,
      frameIndex: index,
      frameName: frame ? nameOf(frame, index) : null,
      selectedLoc: loc && selected ? { ...loc, label: labelOf(selected) } : null,
    });
  }, [frameFile, index, frame, selected]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `mod` and `viewMode` put the canvas in the DOM to listen on
  useEffect(() => {
    const host = frameRef.current;
    if (!host) return;

    const onMove = (e: PointerEvent) => setHovered(pickAt(host, e.clientX, e.clientY));
    const onLeave = () => setHovered(null);
    const onClick = (e: MouseEvent) => {
      const el = pickAt(host, e.clientX, e.clientY);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      select(el);
      setDock('inspect');
      if (pickingComment) {
        setPickingComment(false);
        setCommentFocusTrigger((n) => n + 1);
      }
    };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick, true);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick, true);
    };
  }, [select, mod, viewMode, pickingComment]);

  const onScale = useCallback((next: number) => setApplied(next), []);

  const step = (delta: number) => {
    setIndex((i) => Math.min(frames.length - 1, Math.max(0, i + delta)));
    select(null);
  };

  const queue = (op: EditOp) => {
    if (!selected) return;
    const loc = locOf(selected);
    if (!loc) {
      setStatus('that layer has no source location — is the dev server running?');
      return;
    }
    if (op.kind === 'set-style') {
      if (op.value === null) selected.style.removeProperty(kebab(op.key));
      else selected.style.setProperty(kebab(op.key), op.value);
    } else {
      selected.textContent = op.value;
    }
    setRevision((n) => n + 1);

    const key = `${loc.line}:${loc.column}`;
    setPending((prev) => {
      const next = new Map(prev);
      const entry = next.get(key) ?? { loc, ops: [] };
      const ops = entry.ops.filter(
        (existing) =>
          !(
            existing.kind === op.kind &&
            (op.kind === 'set-text' ||
              (existing.kind === 'set-style' && op.kind === 'set-style' && existing.key === op.key))
          ),
      );
      next.set(key, { loc, ops: [...ops, op] });
      return next;
    });
  };

  const save = async () => {
    if (frameFile === null || pending.size === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      for (const { loc, ops } of pending.values()) {
        const result = await applyEdit(frameFile, loc, ops);
        if (!result.ok) {
          setStatus(result.error);
          return;
        }
        if (!result.changed) {
          setStatus('the source already said that — nothing was written');
          return;
        }
      }
      setPending(new Map());
      setStatus(t('view.savedToSource'));
    } finally {
      setBusy(false);
    }
  };

  const [request, setRequest] = useState<{
    scope: 'frame' | 'file';
    scale: number;
    formats: ExportFormat[];
  } | null>(null);
  const stageHosts = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (request === null) return;
    let cancelled = false;

    const run = async () => {
      try {
        stageHosts.current[0]?.getBoundingClientRect();
        const wanted = request.scope === 'file' ? frames : frames.slice(index, index + 1);
        const offset = request.scope === 'file' ? 0 : index;
        const items: ExportItem[] = [];
        wanted.forEach((f, i) => {
          const element = stageHosts.current[offset + i];
          if (!element) return;
          const number = String(offset + i + 1).padStart(2, '0');
          const name = nameOf(f, offset + i);
          items.push({
            slug: `${number}-${slugOf(name)}`,
            element,
            size: sizeOf(f),
            title: name,
          });
        });

        const written = await exportZip(items, {
          scale: request.scale,
          formats: request.formats,
          filename: frameFile ?? 'frames',
          design,
          onProgress: (done, total, page) => {
            if (!cancelled) setStatus(`Rendering ${done + 1}/${total} — ${page}`);
          },
        });
        if (!cancelled) {
          const count = written.length;
          setStatus(`Saved ${count} ${count === 1 ? 'file' : 'files'} to ${frameFile}.zip`);
        }
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setRequest(null);
          setBusy(false);
        }
      }
    };

    const id = window.setTimeout(() => void run(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [request, frames, index, design, frameFile]);

  const onExport = (scope: 'frame' | 'file', scale: number, formats: ExportFormat[]) => {
    setBusy(true);
    setStatus(null);
    setRequest({ scope, scale, formats });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFinding((v) => !v);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (playing || finding) return;
      if (e.key.toLowerCase() === 'p') setPlaying(true);
      if (e.key.toLowerCase() === 'i') setDock((d) => (d === 'inspect' ? null : 'inspect'));
      if (e.key.toLowerCase() === 'd' && import.meta.env.DEV) {
        setDock((d) => (d === 'changes' ? null : 'changes'));
      }
      if (e.key.toLowerCase() === 'e') setDock((d) => (d === 'export' ? null : 'export'));
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
      if (e.key === 'Escape') {
        if (pickingComment) setPickingComment(false);
        else select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const comments = useComments(import.meta.env.DEV ? frameFile : null);
  const changesState = useChanges(frameFile, import.meta.env.DEV);

  const commentTarget = useMemo(() => {
    if (!selected) return null;
    const loc = locOf(selected);
    return loc ? { line: loc.line, column: loc.column, label: labelOf(selected) } : null;
  }, [selected]);

  const finderActions = useMemo<FinderAction[]>(
    () => [
      {
        key: 'view-single',
        label: t('finder.switchViewSingle'),
        run: () => setViewMode('single'),
      },
      {
        key: 'view-split',
        label: t('finder.switchViewSplit'),
        run: () => setViewMode('split'),
      },
      {
        key: 'view-grid',
        label: t('finder.switchViewGrid'),
        run: () => setViewMode('grid'),
      },
      {
        key: 'dock-inspect',
        label: t('finder.toggleInspect'),
        run: () => setDock((d) => (d === 'inspect' ? null : 'inspect')),
      },
      ...(import.meta.env.DEV
        ? [
            {
              key: 'dock-changes',
              label: t('finder.toggleChanges'),
              run: () => setDock((d) => (d === 'changes' ? null : 'changes')),
            },
          ]
        : []),
      {
        key: 'dock-export',
        label: t('finder.toggleExport'),
        run: () => setDock((d) => (d === 'export' ? null : 'export')),
      },
    ],
    [t],
  );

  const hunkCount = changesState.changes?.hunks.length ?? 0;

  return (
    <div className="odf-shell">
      <header className="odf-topbar">
        <div className="odf-topbar-left">
          <Link className="odf-back" to="/" aria-label={t('nav.allFrames')}>
            ‹
          </Link>
          <span className="odf-segment">
            <span className="odf-seg" aria-current="true">
              {t('view.frames')}
            </span>
            <Link className="odf-seg" to={`/f/${frameFile}/assets`}>
              {t('view.assets')}
            </Link>
          </span>
          {frames.length > 1 ? (
            <span className="odf-segment">
              <button
                type="button"
                className="odf-seg"
                aria-current={viewMode === 'single'}
                onClick={() => setViewMode('single')}
              >
                {t('view.single')}
              </button>
              <button
                type="button"
                className="odf-seg"
                aria-current={viewMode === 'split'}
                onClick={() => setViewMode('split')}
              >
                {t('view.split')}
              </button>
              <button
                type="button"
                className="odf-seg"
                aria-current={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                {t('view.grid')}
              </button>
            </span>
          ) : null}
        </div>

        <div className="odf-topbar-center">
          <span className="odf-title">{mod?.meta?.title ?? frameFile}</span>
        </div>

        <div className="odf-topbar-right">
          <LanguageMenu />
          {viewMode === 'single' ? (
            <div className="odf-zoom">
              <button
                type="button"
                aria-label={t('view.zoomOut')}
                onClick={() => setZoom((z) => Math.max(0.1, (z ?? applied) - 0.1))}
              >
                −
              </button>
              <button type="button" className="odf-zoom-value" onClick={() => setZoom(undefined)}>
                {Math.round(applied * 100)}%
              </button>
              <button
                type="button"
                aria-label={t('view.zoomIn')}
                onClick={() => setZoom((z) => Math.min(4, (z ?? applied) + 0.1))}
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="odf-btn"
            onClick={() => setPlaying(true)}
            disabled={frames.length === 0}
          >
            <i aria-hidden="true">▶</i> {t('view.play')} <kbd>P</kbd>
          </button>
          <button
            type="button"
            className="odf-btn"
            aria-pressed={dock === 'inspect'}
            onClick={() => setDock((d) => (d === 'inspect' ? null : 'inspect'))}
          >
            <i aria-hidden="true">◎</i> {t('view.inspect')} <kbd>I</kbd>
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              className="odf-btn"
              aria-pressed={dock === 'changes'}
              onClick={() => setDock((d) => (d === 'changes' ? null : 'changes'))}
            >
              <i aria-hidden="true">Δ</i> {t('view.changes')}
              {hunkCount > 0 ? <span className="odf-btn-badge">{hunkCount}</span> : null}
              <kbd>D</kbd>
            </button>
          ) : null}
          <button
            type="button"
            className="odf-btn odf-btn-primary"
            aria-pressed={dock === 'export'}
            onClick={() => setDock((d) => (d === 'export' ? null : 'export'))}
          >
            <i aria-hidden="true">↓</i> {t('view.export')} <kbd>E</kbd>
          </button>
        </div>
      </header>

      <div className="odf-body">
        <aside className="odf-side">
          <FrameRail
            frames={frames}
            design={design}
            current={index}
            onSelect={(i) => {
              setIndex(i);
              select(null);
            }}
          />
        </aside>

        <main
          className={pickingComment ? 'odf-stage odf-stage-picking' : 'odf-stage'}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) select(null);
          }}
        >
          {error ? (
            <p className="odf-error">{error}</p>
          ) : viewMode === 'grid' ? (
            <div className="odf-storyboard-grid">
              {frames.map((Artboard, i) => {
                const artSize = sizeOf(Artboard);
                const artName = nameOf(Artboard, i);
                return (
                  <button
                    key={artName}
                    type="button"
                    className="odf-storyboard-cell"
                    aria-current={i === index}
                    onClick={() => {
                      setIndex(i);
                      setViewMode('single');
                      select(null);
                    }}
                  >
                    <span className="odf-storyboard-preview">
                      <FrameCanvas size={artSize} design={design} flat>
                        <Artboard />
                      </FrameCanvas>
                    </span>
                    <span className="odf-storyboard-caption">
                      <b>{String(i + 1).padStart(2, '0')}</b> {artName}
                      <i>
                        {artSize.width}×{artSize.height}
                      </i>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : viewMode === 'split' && Current && SplitFrame ? (
            <div className="odf-split-stage">
              <div className="odf-split-pane">
                <div className="odf-split-head">
                  <span>
                    {String(index + 1).padStart(2, '0')} · {nameOf(Current, index)}
                  </span>
                </div>
                <div className="odf-split-canvas">
                  <FrameCanvas size={size} design={design} innerRef={frameRef} onScale={onScale}>
                    <Current />
                    {hovered && hovered !== selected ? (
                      <Selection element={hovered} host={frameRef.current} variant="hover" />
                    ) : null}
                    {selected ? <Selection element={selected} host={frameRef.current} /> : null}
                  </FrameCanvas>
                </div>
              </div>
              <div className="odf-split-pane">
                <div className="odf-split-head">
                  <select
                    className="odf-select"
                    value={splitIndex}
                    onChange={(e) => setSplitIndex(Number(e.target.value))}
                  >
                    {frames.map((f, i) => (
                      <option key={nameOf(f, i)} value={i}>
                        {String(i + 1).padStart(2, '0')} · {nameOf(f, i)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="odf-split-canvas">
                  <FrameCanvas size={sizeOf(SplitFrame)} design={design}>
                    <SplitFrame />
                  </FrameCanvas>
                </div>
              </div>
            </div>
          ) : Current ? (
            <FrameCanvas
              size={size}
              design={design}
              scale={zoom}
              innerRef={frameRef}
              onScale={onScale}
            >
              <Current />
              {hovered && hovered !== selected ? (
                <Selection element={hovered} host={frameRef.current} variant="hover" />
              ) : null}
              {selected ? <Selection element={selected} host={frameRef.current} /> : null}
              {import.meta.env.DEV ? (
                <CanvasPins
                  host={frameRef.current}
                  comments={comments.comments}
                  hunks={changesState.changes?.hunks ?? []}
                  showHunks={dock === 'changes'}
                  activeHunkId={activeHunkId}
                  onSelectElement={(el) => {
                    select(el);
                    setDock('inspect');
                  }}
                  onSelectHunk={(id, el) => {
                    setActiveHunkId(id);
                    select(el);
                  }}
                />
              ) : null}
            </FrameCanvas>
          ) : null}

          {import.meta.env.DEV ? (
            <CommentDock
              comments={comments.comments}
              error={comments.error}
              picking={pickingComment}
              host={frameRef.current}
              onTogglePicking={() => setPickingComment((v) => !v)}
              onSelectElement={(el) => {
                select(el);
                setDock('inspect');
              }}
              onRemove={(id) => void comments.remove(id)}
            />
          ) : null}
        </main>

        {dock === 'changes' ? (
          <aside className="odf-dock">
            <ChangesPanel
              changes={changesState.changes}
              revisions={changesState.revisions}
              against={changesState.against}
              loading={changesState.loading}
              error={changesState.error}
              activeHunkId={activeHunkId}
              host={frameRef.current}
              onChangeAgainst={changesState.setAgainst}
              onSelectHunk={(id, el) => {
                setActiveHunkId(id);
                if (el) select(el);
              }}
              onRevert={changesState.revert}
              onClose={() => setDock(null)}
            />
          </aside>
        ) : dock ? (
          <aside className="odf-dock">
            <InspectPanel
              mode={dock}
              frameId={frameFile}
              host={frameRef.current}
              design={design}
              size={size}
              layers={layers}
              selected={selected}
              revision={revision}
              commentTarget={import.meta.env.DEV ? commentTarget : null}
              commentFocusTrigger={commentFocusTrigger}
              onComment={import.meta.env.DEV ? comments.add : null}
              onSelect={select}
              busy={busy}
              status={status}
              frameCount={frames.length}
              unsaved={pending.size}
              onExport={onExport}
              onClose={() => setDock(null)}
              onStyle={(key, value) => queue({ kind: 'set-style', key, value })}
              onText={(value) => queue({ kind: 'set-text', value })}
            />
          </aside>
        ) : null}
      </div>

      {pending.size > 0 ? (
        <div className="odf-savebar">
          <span className="odf-savebar-count">
            {t('view.layersEdited', {
              n: pending.size,
              unit: pending.size === 1 ? t('view.layerSingular') : t('view.layerPlural'),
            })}
          </span>
          <button type="button" className="odf-chip" onClick={() => window.location.reload()}>
            {t('view.discard')}
          </button>
          <button
            type="button"
            className="odf-primary odf-save"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? t('view.saving') : t('view.saveToSource')}
          </button>
        </div>
      ) : null}

      {request ? <ExportStage frames={frames} design={design} hostsRef={stageHosts} /> : null}

      {playing ? (
        <Player
          frames={frames}
          design={design}
          index={index}
          title={mod?.meta?.title ?? frameFile ?? 'Frame'}
          onIndex={(next) => {
            setIndex(next);
            select(null);
          }}
          onClose={() => setPlaying(false)}
        />
      ) : null}

      {finding ? (
        <Finder
          artboards={frames}
          onSelectArtboard={(i) => {
            setIndex(i);
            select(null);
          }}
          actions={finderActions}
          onClose={() => setFinding(false)}
        />
      ) : null}

      <footer className="odf-statusbar">
        <span className="odf-status-left">
          <i aria-hidden="true">▦</i> {frameFile}
          {selected ? <span className="odf-status-sel">{labelOf(selected)}</span> : null}
        </span>
        <span className="odf-status-right">
          frame {frames.length === 0 ? 0 : index + 1}/{frames.length}
          {size.width ? ` · ${size.width}×${size.height}` : ''}
        </span>
      </footer>
    </div>
  );
}
