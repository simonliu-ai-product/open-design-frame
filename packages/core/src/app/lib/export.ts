import { zipSync } from 'fflate';
import { toBlob, toSvg } from 'html-to-image';
import { type DesignSystem, designToCssVars } from './design.ts';
import type { FrameSize } from './sdk.ts';

export type ExportFormat = 'html' | 'png' | 'svg';

export type ExportItem = {
  /** `01-overview-desktop` — the file's name inside each folder. */
  slug: string;
  element: HTMLElement;
  size: FrameSize;
  title: string;
};

export type ExportOptions = {
  scale: number;
  formats: ExportFormat[];
  filename: string;
  design: DesignSystem;
  /** Called before each page, so a slow export does not look like a frozen one. */
  onProgress?: (done: number, total: number, page: string) => void;
};

/** A page that has not rendered in this long is not going to. */
const PAGE_TIMEOUT_MS = 45_000;

/**
 * Fail loudly rather than hang.
 *
 * Drawing a page goes through an image the browser has to decode, and a
 * document that is not being painted may never get to it — a button stuck on
 * "Exporting…" with nothing to read is worse than a refusal.
 */
function withTimeout<T>(work: Promise<T>, page: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `${page} did not render within 45s — if this tab is in the background, ` +
              'bring it to the front and try again.',
          ),
        ),
      PAGE_TIMEOUT_MS,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously races the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'frame';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A frame as a page that opens on its own.
 *
 * Everything a frame draws with is either an inline style or an `--odf-*`
 * token, so the markup plus the tokens is the whole picture — no stylesheet to
 * ship beside it and nothing to go missing when the folder is passed on.
 * The editor's own attributes are stripped: a source line number is our
 * business, not the reader's.
 */
export function frameHtml(item: ExportItem, design: DesignSystem): string {
  const clone = item.element.cloneNode(true) as HTMLElement;
  for (const el of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
    for (const name of [...el.getAttributeNames()]) {
      if (name.startsWith('data-of')) el.removeAttribute(name);
    }
  }
  clone.style.removeProperty('transform');
  clone.style.removeProperty('transform-origin');

  const vars = Object.entries(designToCssVars(design))
    .map(([key, value]) => `      ${key}: ${value};`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(item.title)}</title>
    <style>
      :root {
${vars}
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        background: #e9eaee;
        font-family: var(--odf-font-body);
        color: var(--odf-text);
      }
      .frame {
        position: relative;
        width: ${item.size.width}px;
        height: ${item.size.height}px;
        overflow: hidden;
        background: var(--odf-bg);
      }
    </style>
  </head>
  <body>
    <div class="frame">${clone.innerHTML}</div>
  </body>
</html>
`;
}

async function pngBytes(element: HTMLElement, pixelRatio: number): Promise<Uint8Array> {
  const blob = await toBlob(element, {
    pixelRatio,
    // The transform belongs to the canvas, not to the frame; carrying it into
    // the capture would scale the picture twice.
    style: { transform: 'none', transformOrigin: 'top left' },
    cacheBust: true,
  });
  if (!blob) throw new Error('the frame produced no image');
  return new Uint8Array(await blob.arrayBuffer());
}

async function svgText(element: HTMLElement): Promise<string> {
  const dataUrl = await toSvg(element, {
    style: { transform: 'none', transformOrigin: 'top left' },
    cacheBust: true,
  });
  return decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
}

/**
 * One zip, one folder per format.
 *
 * A design goes to whoever asked for it as a set of files, and a set of files
 * is a folder — not four separate downloads a person then has to name and sort
 * themselves. The scale applies to the PNGs only: HTML and SVG have no pixels
 * to multiply.
 */
export async function exportZip(items: ExportItem[], opts: ExportOptions): Promise<string[]> {
  if (items.length === 0) throw new Error('there is nothing to export');
  if (opts.formats.length === 0) throw new Error('choose at least one format');

  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};

  for (const [index, item] of items.entries()) {
    opts.onProgress?.(index, items.length, item.title);
    if (opts.formats.includes('html')) {
      files[`html/${item.slug}.html`] = encoder.encode(frameHtml(item, opts.design));
    }
    if (opts.formats.includes('png')) {
      files[`png/${item.slug}.png`] = await withTimeout(
        pngBytes(item.element, opts.scale),
        item.title,
      );
    }
    if (opts.formats.includes('svg')) {
      files[`svg/${item.slug}.svg`] = encoder.encode(
        await withTimeout(svgText(item.element), item.title),
      );
    }
  }

  const zipped = zipSync(files, { level: 6 });
  download(new Blob([zipped as BlobPart], { type: 'application/zip' }), `${opts.filename}.zip`);
  return Object.keys(files).sort();
}
