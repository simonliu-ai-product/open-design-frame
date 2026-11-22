import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OpsContext } from '../ops/context.ts';
import { OpsError } from '../ops/context.ts';

/**
 * Drawing frames in a headless browser, for checks that only a real layout can
 * answer (does it throw, does it overflow, do its images load) and for pictures
 * of a frame. The page is the viewer's own `/f/<id>/render`, so what is checked
 * is what the canvas draws; nothing is re-implemented on the Node side.
 *
 * Playwright is not a dependency of core — it is large and only people who
 * render headlessly need it — so it is found in the user's workspace, the way
 * the MCP package is, and its API is described here with local types.
 */

type Page = {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  evaluate<T>(fn: string): Promise<T>;
  locator(selector: string): { screenshot(opts?: { type?: 'png' }): Promise<Uint8Array> };
  close(): Promise<void>;
};
type Context = { newPage(): Promise<Page>; close(): Promise<void> };
type Browser = {
  newContext(opts?: {
    deviceScaleFactor?: number;
    viewport?: { width: number; height: number };
  }): Promise<Context>;
  close(): Promise<void>;
};
type Playwright = { chromium: { launch(opts?: { headless?: boolean }): Promise<Browser> } };

export const PLAYWRIGHT_MISSING =
  'Rendering needs Playwright in this workspace: pnpm add -D playwright && pnpm exec playwright install chromium';

const READY_TIMEOUT_MS = 30_000;
const IDLE_CLOSE_MS = 60_000;

function findPlaywright(userCwd: string): string | null {
  let dir = path.resolve(userCwd);
  for (;;) {
    const manifest = path.join(dir, 'node_modules', 'playwright', 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { main?: string };
      return path.join(path.dirname(manifest), pkg.main ?? 'index.js');
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Whether this workspace can draw frames at all. */
export function hasPlaywright(userCwd: string): boolean {
  return findPlaywright(userCwd) !== null;
}

async function loadPlaywright(userCwd: string): Promise<Playwright> {
  const entry = findPlaywright(userCwd);
  if (!entry) throw new OpsError(424, PLAYWRIGHT_MISSING);
  const mod = (await import(pathToFileURL(entry).href)) as Playwright & { default?: Playwright };
  return mod.chromium ? mod : (mod.default as Playwright);
}

export type RenderedFrame = {
  index: number;
  name: string;
  width: number;
  height: number;
  findings: {
    rule: string;
    severity: 'error' | 'warn';
    message: string;
    element?: string;
    loc?: string;
  }[];
};
export type RenderReport = {
  file: string;
  title: string | null;
  frames: RenderedFrame[];
  error?: string;
};

type Session = {
  origin: string;
  browser: Browser;
  closeServer: (() => Promise<void>) | null;
  idle: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, Promise<Session>>();

async function startSession(ctx: OpsContext, origin?: string): Promise<Session> {
  const playwright = await loadPlaywright(ctx.userCwd);
  let closeServer: Session['closeServer'] = null;
  let base = origin;
  if (!base) {
    const [{ createServer }, { createViteConfig }] = await Promise.all([
      import('vite'),
      import('../vite/config.ts'),
    ]);
    // The agent belongs to the dev server people use; a second copy would save
    // its own stale view of the sessions over theirs when this one closes.
    const config = await createViteConfig({ userCwd: ctx.userCwd, agent: false });
    const server = await createServer({
      ...config,
      logLevel: 'silent',
      server: { ...config.server, port: 0, strictPort: false, open: false, hmr: false },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0]?.replace(/\/$/, '');
    if (!base) {
      await server.close();
      throw new OpsError(500, 'the render server did not report an address');
    }
    closeServer = () => server.close();
  }
  const browser = await playwright.chromium.launch({ headless: true });
  return { origin: base, browser, closeServer, idle: null };
}

/** One browser (and, without a running dev server, one server) per workspace, closed after a minute unused. */
async function session(ctx: OpsContext, origin?: string): Promise<Session> {
  const key = `${ctx.userCwd}\0${origin ?? ''}`;
  let pending = sessions.get(key);
  if (!pending) {
    pending = startSession(ctx, origin);
    sessions.set(key, pending);
    pending.catch(() => sessions.delete(key));
  }
  const s = await pending;
  if (s.idle) clearTimeout(s.idle);
  s.idle = setTimeout(() => {
    sessions.delete(key);
    void closeSession(s);
  }, IDLE_CLOSE_MS);
  s.idle.unref?.();
  return s;
}

async function closeSession(s: Session): Promise<void> {
  if (s.idle) clearTimeout(s.idle);
  await s.browser.close().catch(() => {});
  await s.closeServer?.().catch(() => {});
}

/** Closes every browser and server this process started; a CLI calls it before it exits. */
export async function closeRenderSessions(): Promise<void> {
  const all = [...sessions.values()];
  sessions.clear();
  await Promise.all(all.map((p) => p.then(closeSession, () => {})));
}

export type RenderOptions = {
  /** A dev server already serving this workspace; without one, a private one is started. */
  origin?: string;
  /** Device pixels per CSS pixel for pictures. */
  scale?: number;
};

async function withPage<T>(
  ctx: OpsContext,
  id: string,
  opts: RenderOptions,
  fn: (page: Page, report: RenderReport) => Promise<T>,
): Promise<T> {
  const s = await session(ctx, opts.origin);
  const context = await s.browser.newContext({
    deviceScaleFactor: opts.scale ?? 1,
    viewport: { width: 1600, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${s.origin}/f/${encodeURIComponent(id)}/render`, {
      waitUntil: 'load',
      timeout: READY_TIMEOUT_MS,
    });
    try {
      await page.waitForFunction('Boolean(window.__openDesignFrame)', undefined, {
        timeout: READY_TIMEOUT_MS,
      });
    } catch {
      throw new OpsError(
        500,
        `frames/${id} did not load in the browser within ${READY_TIMEOUT_MS / 1000}s — open it in the viewer to see why`,
      );
    }
    const report = await page.evaluate<RenderReport>('window.__openDesignFrame.ready()');
    return await fn(page, report);
  } finally {
    await context.close().catch(() => {});
  }
}

/** Draws a frame file and reports what only a layout shows. */
export function renderCheck(
  ctx: OpsContext,
  id: string,
  opts: RenderOptions = {},
): Promise<RenderReport> {
  return withPage(ctx, id, opts, async (_page, report) => report);
}

export type FramePicture = {
  name: string;
  index: number;
  width: number;
  height: number;
  png: Uint8Array;
};

/** A PNG of one frame (by name or index; the first when left out), at its own size times `scale`. */
export function renderFrameImage(
  ctx: OpsContext,
  id: string,
  frame?: string | number,
  opts: RenderOptions = {},
): Promise<FramePicture> {
  return withPage(ctx, id, opts, async (page, report) => {
    if (report.error) throw new OpsError(422, `frames/${id} does not load: ${report.error}`);
    const pick =
      frame === undefined
        ? report.frames[0]
        : typeof frame === 'number'
          ? report.frames[frame]
          : report.frames.find((f) => f.name === frame);
    if (!pick) {
      const names = report.frames.map((f) => f.name).join(', ');
      throw new OpsError(
        404,
        `no frame ${JSON.stringify(frame)} in frames/${id} — it has: ${names}`,
      );
    }
    const png = await page
      .locator(`[data-odf-render-frame="${pick.index}"]`)
      .screenshot({ type: 'png' });
    return { name: pick.name, index: pick.index, width: pick.width, height: pick.height, png };
  });
}
