import { loadFrame } from 'virtual:open-design-frame/frames';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FrameBoundary } from '../components/frame-boundary.tsx';
import { designToCssVars, mergeDesign } from '../lib/design.ts';
import { type DomDiagnostic, diagnoseFrameDom } from '../lib/diagnostics.ts';
import { type FrameModule, nameOf, sizeOf } from '../lib/sdk.ts';

export type RenderedFrame = {
  index: number;
  name: string;
  width: number;
  height: number;
  findings: DomDiagnostic[];
};

export type RenderReport = {
  file: string;
  title: string | null;
  frames: RenderedFrame[];
  /** The file did not load at all (a syntax error, a missing import); no frames were drawn. */
  error?: string;
};

export type RenderBridge = {
  version: 1;
  /** Resolves once every frame is drawn with its fonts and images settled. */
  ready: () => Promise<RenderReport>;
  /** The report for what is on the page now; null before it is ready. */
  diagnose: () => RenderReport | null;
};

declare global {
  interface Window {
    __openDesignFrame?: RenderBridge;
  }
}

export const RENDER_FRAME_ATTR = 'data-odf-render-frame';
const IMAGE_TIMEOUT_MS = 8000;

/** Settles when every image on the page has loaded or failed, or the timeout passes. */
function imagesSettled(root: HTMLElement): Promise<void> {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((done) => {
            img.addEventListener('load', () => done(), { once: true });
            img.addEventListener('error', () => done(), { once: true });
          }),
      ),
    ).then(() => undefined),
    new Promise<void>((done) => setTimeout(done, IMAGE_TIMEOUT_MS)),
  ]);
}

/**
 * Every frame of one file at its own size, one under another, with nothing
 * else on the page — for a headless check or a screenshot, by this package's
 * own CLI and MCP tools or by any host app that loads `/f/<id>/render` in a
 * window of its own. `window.__openDesignFrame` reports what the page drew.
 *
 * Nothing here waits on an animation frame: a page that is not painted (a
 * background window, a headless tab) gets none.
 */
export function FrameRender() {
  const { fileId } = useParams<{ fileId: string }>();
  const file = fileId ?? '';
  const [mod, setMod] = useState<FrameModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hosts = useRef<(HTMLDivElement | null)[]>([]);
  const report = useRef<RenderReport | null>(null);
  const waiting = useRef<((r: RenderReport) => void)[]>([]);

  useEffect(() => {
    report.current = null;
    document.documentElement.removeAttribute('data-odf-render-ready');
    window.__openDesignFrame = {
      version: 1,
      ready: () =>
        report.current
          ? Promise.resolve(report.current)
          : new Promise((resolve) => waiting.current.push(resolve)),
      diagnose: () => report.current,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMod(null);
    setError(null);
    loadFrame(file)
      .then((loaded) => {
        if (cancelled) return;
        const next = loaded as FrameModule;
        if (!Array.isArray(next.default) || next.default.length === 0) {
          setError(`frames/${file} exports no frames — default must be an array.`);
        } else setMod(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!mod && !error) return;
    let cancelled = false;
    const finish = (next: RenderReport) => {
      if (cancelled) return;
      report.current = next;
      document.documentElement.setAttribute('data-odf-render-ready', 'true');
      for (const resolve of waiting.current.splice(0)) resolve(next);
    };
    if (error) {
      finish({ file, title: null, frames: [], error });
      return;
    }
    const frames = mod?.default ?? [];
    const settle = async () => {
      await document.fonts.ready;
      if (rootRef.current) await imagesSettled(rootRef.current);
      // One more task, so layout after the last image has run.
      await new Promise((r) => setTimeout(r, 0));
      finish({
        file,
        title: mod?.meta?.title ?? null,
        frames: frames.map((frame, index) => {
          const size = sizeOf(frame);
          const host = hosts.current[index];
          return {
            index,
            name: nameOf(frame, index),
            width: size.width,
            height: size.height,
            findings: host ? diagnoseFrameDom(host, size) : [],
          };
        }),
      });
    };
    void settle();
    return () => {
      cancelled = true;
    };
  }, [mod, error, file]);

  const design = mergeDesign(mod?.design);
  const vars = designToCssVars(design) as CSSProperties;
  return (
    <div ref={rootRef} className="odf-render">
      {error ? <pre className="odf-render-error">{error}</pre> : null}
      {(mod?.default ?? []).map((frame, index) => {
        const size = sizeOf(frame);
        const Component = frame;
        return (
          <div
            key={nameOf(frame, index)}
            ref={(el) => {
              hosts.current[index] = el;
            }}
            className="odf-frame odf-frame-flat"
            data-odf-frame-name={nameOf(frame, index)}
            {...{ [RENDER_FRAME_ATTR]: String(index) }}
            style={{ ...vars, position: 'relative', width: size.width, height: size.height }}
          >
            <FrameBoundary>
              <Component />
            </FrameBoundary>
          </div>
        );
      })}
    </div>
  );
}
