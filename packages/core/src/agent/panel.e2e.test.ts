import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViteConfig } from '../vite/config.ts';

/*
 * The agent panel in the real viewer, driven by a browser, with a scripted
 * stand-in for the Codex SDK: no network, no API key, no Codex login. The
 * stand-in edits the frame file the way a turn would, so what follows — the
 * transcript, the check the dev server runs, the canvas reloading — is the
 * framework's own code.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const playwrightEntry = path.join(repoRoot, 'node_modules', 'playwright', 'index.js');
const hasBuild = existsSync(path.resolve(here, '../../dist/index.js'));

type Locator = {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  press(key: string): Promise<void>;
  count(): Promise<number>;
  textContent(): Promise<string | null>;
  isVisible(): Promise<boolean>;
  waitFor(opts?: { state?: 'visible' | 'detached' | 'attached'; timeout?: number }): Promise<void>;
  evaluate<T>(fn: (el: HTMLElement) => T): Promise<T>;
  first(): Locator;
  getByText(text: string | RegExp): Locator;
};
type Page = {
  goto(url: string): Promise<unknown>;
  locator(selector: string): Locator;
  getByRole(role: string, opts: { name: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp): Locator;
  keyboard: { press(key: string): Promise<void> };
  addInitScript(fn: () => void): Promise<void>;
  route(
    url: string,
    handler: (route: { fulfill(opts: { json: unknown }): Promise<void> }) => Promise<void>,
  ): Promise<void>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  reload(): Promise<unknown>;
  close(): Promise<void>;
};
type Browser = {
  newPage(opts?: { viewport?: { width: number; height: number } }): Promise<Page>;
  close(): Promise<void>;
};

const FAKE_SDK = `
import fs from 'node:fs';
import path from 'node:path';
export class Codex {
  startThread(opts) { return this.thread(opts); }
  resumeThread(_id, opts) { return this.thread(opts); }
  thread(opts) {
    return {
      id: 'th-1',
      async runStreamed(input) {
        fs.appendFileSync(path.join(opts.workingDirectory, 'prompts.log'), input + '\\n---\\n');
        const file = path.join(opts.workingDirectory, 'frames', 'landing', 'index.tsx');
        async function* events() {
          yield { type: 'thread.started', thread_id: 'th-1' };
          yield { type: 'item.started', item: { type: 'command_execution', id: 'c1', command: 'cat frames/landing/index.tsx', status: 'in_progress' } };
          yield { type: 'item.completed', item: { type: 'command_execution', id: 'c1', command: 'cat frames/landing/index.tsx', status: 'completed' } };
          fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Ship faster', 'Ship today').replace('width: 640', 'width: 0'));
          yield { type: 'item.completed', item: { type: 'file_change', id: 'f1', status: 'completed', changes: [{ path: file, kind: 'update' }] } };
          yield { type: 'item.completed', item: { type: 'agent_message', id: 'm1', text: 'Changed the **headline**.' } };
          yield { type: 'turn.completed', usage: {} };
        }
        return { events: events() };
      },
    };
  }
}
`;

const FRAME = `const Hero = () => (
  <div style={{ padding: 40 }}>
    <h1 style={{ fontSize: 48 }}>Ship faster</h1>
    <p>Second line</p>
  </div>
);
Hero.frameName = 'Hero';
Hero.size = { width: 640, height: 400 };
export default [Hero];
`;

const MODELS = {
  models: [
    {
      slug: 'gpt-test',
      display_name: 'GPT Test',
      priority: 1,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }],
    },
  ],
};

describe.skipIf(!existsSync(playwrightEntry) || !hasBuild)('agent panel in the viewer', () => {
  let dir: string;
  let server: ViteDevServer;
  let base: string;
  let browser: Browser;
  const savedCodexHome = process.env.CODEX_HOME;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'odf-agent-panel-'));
    mkdirSync(path.join(dir, 'frames', 'landing'), { recursive: true });
    writeFileSync(path.join(dir, 'frames', 'landing', 'index.tsx'), FRAME);
    const sdk = path.join(dir, 'node_modules', '@openai', 'codex-sdk');
    mkdirSync(sdk, { recursive: true });
    writeFileSync(
      path.join(sdk, 'package.json'),
      JSON.stringify({
        name: '@openai/codex-sdk',
        version: '0.0.0-fake',
        type: 'module',
        exports: './index.js',
      }),
    );
    writeFileSync(path.join(sdk, 'index.js'), FAKE_SDK);
    // The model list a signed-in `codex` caches, so the menu does not depend on this machine.
    const codexHome = path.join(dir, 'codex-home');
    mkdirSync(codexHome);
    writeFileSync(path.join(codexHome, 'models_cache.json'), JSON.stringify(MODELS));
    process.env.CODEX_HOME = codexHome;

    const config = await createViteConfig({ userCwd: dir });
    server = await createServer({
      ...config,
      cacheDir: path.join(dir, '.vite'),
      logLevel: 'silent',
      server: { port: 0, strictPort: false, host: '127.0.0.1' },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? '';
    const playwright = (await import(playwrightEntry)) as {
      chromium: { launch(opts: { headless: boolean }): Promise<Browser> };
    };
    browser = await playwright.chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    if (savedCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = savedCodexHome;
    rmSync(dir, { recursive: true, force: true });
  });

  async function open(viewport = { width: 1400, height: 900 }) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/f/landing`);
    await page.locator('h1').first().waitFor({ timeout: 30_000 });
    return page;
  }

  it('runs a turn about the selected element and shows the check that followed', async () => {
    const page = await open();
    try {
      const dock = page.locator('[data-agent-dock]');
      await page.locator('[data-agent-toggle]').waitFor({ timeout: 15_000 });
      expect(await dock.count()).toBe(0);
      await page.keyboard.press('a');
      await page.getByText('What should change?').waitFor();
      await page.getByRole('button', { name: /GPT Test/ }).waitFor();

      // Picking on the canvas points the agent at an element; the dock stays.
      await page.locator('.odf-stage h1').first().click();
      expect(await dock.count()).toBe(1);
      await page.locator('[data-agent-dock] .odf-agent-chip').getByText('<h1>').waitFor();

      const input = page.getByRole('textbox', { name: /Ask Codex/ });
      await input.fill('Make the headline say today');
      await input.press('Enter');

      await page.locator('[data-agent-dock]').getByText('headline').first().waitFor();
      const check = page.locator('[data-agent-dock] [data-agent-check]');
      await check.getByText(/found 1 problem in landing/).waitFor({ timeout: 20_000 });
      expect(await check.textContent()).toContain('non-positive size 0×400');
      await page.getByRole('button', { name: 'Ask the agent to fix' }).waitFor();
      // The canvas picked the write up.
      await page
        .locator('.odf-stage')
        .getByText('Ship today')
        .waitFor({ state: 'attached', timeout: 15_000 });

      const prompt = readFileSync(path.join(dir, 'prompts.log'), 'utf8');
      expect(prompt).toContain('open-design-frame dev server');
      expect(prompt).toMatch(/<h1> element at frames\/landing\/index\.tsx:3:\d+/);
      expect(prompt).toContain('<artboard-name>Hero</artboard-name>');
      expect(prompt).toContain('<selected-text>Ship faster</selected-text>');

      // A reload, as an agent adding a file causes, brings the panel back.
      await page.reload();
      await page.getByText('Make the headline say today').waitFor({ timeout: 30_000 });
    } finally {
      await page.close();
      writeFileSync(path.join(dir, 'frames', 'landing', 'index.tsx'), FRAME);
    }
  }, 90_000);

  it('explains how to install Codex when its CLI is missing', async () => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
      await page.route('**/__agent/status', (route) =>
        route.fulfill({
          json: {
            enabled: true,
            packageManager: 'pnpm',
            providers: [
              {
                id: 'codex',
                name: 'Codex',
                sdkPackage: '@openai/codex-sdk',
                sdkVersion: null,
                cliCommand: 'codex',
                cliFound: false,
                cliVersion: null,
                ready: false,
                models: [],
              },
            ],
          },
        }),
      );
      await page.goto(`${base}/f/landing`);
      await page.locator('[data-agent-toggle]').waitFor({ timeout: 30_000 });
      await page.keyboard.press('a');
      await page.getByText('Install Codex first').waitFor();
      await page.getByText('npm install -g @openai/codex').waitFor();
    } finally {
      await page.close();
    }
  }, 60_000);

  it('floats over the canvas on a narrow window', async () => {
    const page = await open({ width: 760, height: 800 });
    try {
      await page.locator('[data-agent-toggle]').waitFor({ timeout: 15_000 });
      await page.keyboard.press('a');
      const dock = page.locator('[data-agent-dock]');
      await dock.waitFor();
      expect(await dock.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
      // The toggle has given up its label but not its place.
      expect(
        await page
          .locator('[data-agent-toggle] .odf-btn-label')
          .evaluate((el) => getComputedStyle(el).display),
      ).toBe('none');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('stays out of the way when the host brings its own agent', async () => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    try {
      await page.addInitScript(() => {
        (window as unknown as { openxHost: unknown }).openxHost = {
          protocol: 1,
          name: 'test host',
          capabilities: ['agent'],
        };
      });
      await page.goto(`${base}/f/landing`);
      await page.locator('h1').first().waitFor({ timeout: 30_000 });
      await page.keyboard.press('a');
      await new Promise((r) => setTimeout(r, 500));
      expect(await page.locator('[data-agent-toggle]').count()).toBe(0);
      expect(await page.locator('[data-agent-dock]').count()).toBe(0);
    } finally {
      await page.close();
    }
  }, 60_000);
});
