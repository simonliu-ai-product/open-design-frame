import { frameIds, loadFrame } from 'virtual:open-design-frame/frames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommentDock } from '../components/comment-dock.tsx';
import { ExportStage } from '../components/export-stage.tsx';
import { FrameCanvas } from '../components/frame-canvas.tsx';
import { FrameRail } from '../components/frame-rail.tsx';
import { InspectPanel } from '../components/inspect-panel.tsx';
import { Player } from '../components/player.tsx';
import { Selection } from '../components/selection.tsx';
import { useComments } from '../lib/comments.ts';
import { mergeDesign } from '../lib/design.ts';
import { applyEdit, type EditOp, type Loc, locOf } from '../lib/editor.ts';
import { type ExportFormat, type ExportItem, exportZip, slugOf } from '../lib/export.ts';
import { collectLayers, type LayerNode } from '../lib/layers.ts';
import { labelOf, type Pick, pickAt, pickOf, resolvePick, samePick } from '../lib/pick.ts';
import { type FrameModule, nameOf, sizeOf } from '../lib/sdk.ts';

type Dock = 'inspect' | 'export' | null;

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function FrameView() {
  const { fileId = '' } = useParams();
  const frameFile = frameIds.includes(fileId) ? fileId : null;
  const [mod, setMod] = useState<FrameModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [dock, setDock] = useState<Dock>('inspect');
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [applied, setApplied] = useState(1);
  const [layers, setLayers] = useState<LayerNode[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /*
   * Edits are held until saved, keyed by the element they belong to. Writing on
   * every keystroke would put a file write and an HMR reload behind each digit
   * of a font size — the canvas shows the change immediately either way.
   */
  const [pending, setPending] = useState<Map<string, { loc: Loc; ops: EditOp[] }>>(new Map());
  const [revision, setRevision] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

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
  const size = frame ? sizeOf(frame) : { width: 0, height: 0 };

  /*
   * Keyed by which frame is on screen, not by the component identity: the tree
   * is read out of the DOM after React commits, and a re-render of the same
   * frame leaves that DOM alone.
   */
  const renderedKey = `${frameFile}:${index}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the trigger, not an input
  useEffect(() => {
    const host = frameRef.current;
    // `mod` is in the deps because the canvas does not exist until the module
    // has loaded — keyed only by the frame, this ran once against a null ref
    // and never again, and the panel reported a frame with no layers.
    if (!host) return;
    setLayers(collectLayers(host));
    // Every element is a new object after a reload, so the selection is found
    // again from what it was, not held as a reference that is now detached.
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

  /*
   * Picking happens on the canvas, not only in the layer list: the thing a
   * designer is looking at is the thing they point at, and most of a frame is
   * never wrapped in a named Layer.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mod` is what puts the canvas in the DOM to listen on
  useEffect(() => {
    const host = frameRef.current;
    // The canvas does not exist until the module has loaded, and a listener
    // attached before it does is attached to nothing.
    if (!host) return;

    const onMove = (e: PointerEvent) => setHovered(pickAt(host, e.clientX, e.clientY));
    const onLeave = () => setHovered(null);
    const onClick = (e: MouseEvent) => {
      const el = pickAt(host, e.clientX, e.clientY);
      if (!el) return;
      // A frame may contain a link or a button; on a design canvas a click
      // means "select this", not "follow it".
      e.preventDefault();
      e.stopPropagation();
      select(el);
      setDock('inspect');
    };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick, true);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick, true);
    };
  }, [select, mod]);

  const onScale = useCallback((next: number) => setApplied(next), []);

  const step = (delta: number) => {
    setIndex((i) => Math.min(frames.length - 1, Math.max(0, i + delta)));
    select(null);
  };

  /**
   * Stage the edit and show it at once.
   *
   * The preview is the element's own inline style, which is what the save will
   * write into the source — so what the canvas shows between the change and the
   * save is the result, not an approximation of it.
   */
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
      // One op per property, so dragging a slider twice writes once.
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
      setStatus('Saved to source');
    } finally {
      setBusy(false);
    }
  };

  /*
   * An export needs every frame laid out, and only one is on the canvas — so a
   * request mounts an off-screen stage and is carried out once React has
   * committed it. Two frames of waiting, because a fresh subtree has no layout
   * on the tick it appears.
   */
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
        // Reading a box flushes pending layout, so the stage is measured rather
        // than assumed to have settled.
        stageHosts.current[0]?.getBoundingClientRect();
        const wanted = request.scope === 'file' ? frames : frames.slice(index, index + 1);
        const offset = request.scope === 'file' ? 0 : index;
        const items: ExportItem[] = [];
        wanted.forEach((frame, i) => {
          const element = stageHosts.current[offset + i];
          if (!element) return;
          const number = String(offset + i + 1).padStart(2, '0');
          const name = nameOf(frame, offset + i);
          items.push({
            slug: `${number}-${slugOf(name)}`,
            element,
            size: sizeOf(frame),
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

    /*
     * A timeout, not an animation frame: this effect already runs after React
     * has committed the stage, and a tab that is not being painted gets no
     * frames at all — an export started in a background tab would never begin.
     */
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
      const target = e.target as HTMLElement | null;
      // Arrow keys belong to whatever field has focus before they belong here.
      if (target?.closest('input, textarea, select')) return;
      if (playing) return;
      if (e.key.toLowerCase() === 'p') setPlaying(true);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Dev only: there is no server to write a note into the source in a build.
  const comments = useComments(import.meta.env.DEV ? frameFile : null);

  const commentTarget = useMemo(() => {
    if (!selected) return null;
    const loc = locOf(selected);
    return loc ? { line: loc.line, column: loc.column, label: labelOf(selected) } : null;
  }, [selected]);

  return (
    <div className="odf-shell">
      <header className="odf-topbar">
        <div className="odf-topbar-left">
          <Link className="odf-back" to="/" aria-label="All frames">
            ‹
          </Link>
          <span className="odf-segment">
            <span className="odf-seg" aria-current="true">
              Frames
            </span>
            <Link className="odf-seg" to={`/assets?scope=${frameFile}`}>
              Assets
            </Link>
          </span>
        </div>

        <div className="odf-topbar-center">
          <span className="odf-title">{mod?.meta?.title ?? frameFile}</span>
        </div>

        <div className="odf-topbar-right">
          <div className="odf-zoom">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.1, (z ?? applied) - 0.1))}
            >
              −
            </button>
            <button type="button" className="odf-zoom-value" onClick={() => setZoom(undefined)}>
              {Math.round(applied * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(4, (z ?? applied) + 0.1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="odf-btn"
            onClick={() => setPlaying(true)}
            disabled={frames.length === 0}
          >
            <i aria-hidden="true">▶</i> Play <kbd>P</kbd>
          </button>
          <button
            type="button"
            className="odf-btn"
            aria-pressed={dock === 'inspect'}
            onClick={() => setDock((d) => (d === 'inspect' ? null : 'inspect'))}
          >
            <i aria-hidden="true">◎</i> Inspect <kbd>I</kbd>
          </button>
          <button
            type="button"
            className="odf-btn odf-btn-primary"
            aria-pressed={dock === 'export'}
            onClick={() => setDock((d) => (d === 'export' ? null : 'export'))}
          >
            <i aria-hidden="true">↓</i> Export <kbd>E</kbd>
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
          className="odf-stage"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) select(null);
          }}
        >
          {error ? (
            <p className="odf-error">{error}</p>
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
            </FrameCanvas>
          ) : null}

          {import.meta.env.DEV ? (
            <CommentDock
              comments={comments.comments}
              error={comments.error}
              onRemove={(id) => void comments.remove(id)}
            />
          ) : null}
        </main>

        {dock ? (
          <aside className="odf-dock">
            <InspectPanel
              mode={dock}
              design={design}
              size={size}
              layers={layers}
              selected={selected}
              revision={revision}
              commentTarget={import.meta.env.DEV ? commentTarget : null}
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
            {pending.size} {pending.size === 1 ? 'layer' : 'layers'} edited
          </span>
          <button type="button" className="odf-chip" onClick={() => window.location.reload()}>
            Discard
          </button>
          <button
            type="button"
            className="odf-primary odf-save"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save to source'}
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
