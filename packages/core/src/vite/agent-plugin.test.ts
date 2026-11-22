import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AgentSession } from '../agent/types.ts';
import { parseContext, parseModel, parseRespond, parseTurnSettings } from './agent-plugin.ts';
import { createViteConfig } from './config.ts';

describe('agent request parsing', () => {
  it('keeps a well-formed turn context and clips what it does not trust', () => {
    const ctx = parseContext({
      frameId: 'landing',
      frameTitle: 'x'.repeat(300),
      pendingComments: 2.7,
      artboard: { index: 1, total: 3, name: 'Hero', width: 1440.4, height: 1024 },
      selection: { line: 12, column: 4, label: 'Headline', tagName: 'h1', text: 'Hi' },
    });
    expect(ctx?.frameId).toBe('landing');
    expect(ctx?.frameTitle).toHaveLength(120);
    expect(ctx?.pendingComments).toBe(2);
    expect(ctx?.artboard).toEqual({ index: 1, total: 3, name: 'Hero', width: 1440, height: 1024 });
    expect(ctx?.selection).toEqual({
      line: 12,
      column: 4,
      label: 'Headline',
      tagName: 'h1',
      text: 'Hi',
    });
  });

  it('drops a frame id that could leave the frames folder, and an artboard past the end', () => {
    const ctx = parseContext({
      frameId: '../etc',
      artboard: { index: 3, total: 3, name: 'x', width: 1, height: 1 },
      selection: { line: 'one', column: 1 },
    });
    expect(ctx).toEqual({});
    expect(parseContext(null)).toBeUndefined();
  });

  it('accepts model ids and efforts it knows, and nothing else', () => {
    expect(parseModel('gpt-5.1-codex')).toBe('gpt-5.1-codex');
    expect(parseModel('a b')).toBeNull();
    expect(parseTurnSettings({ model: 'x;rm', effort: 'turbo' })).toEqual({
      model: null,
      effort: null,
    });
    expect(parseTurnSettings({ effort: 'high' })).toEqual({ effort: 'high' });
  });

  it('reads answers or a skip, and refuses anything else', () => {
    expect(parseRespond({ answers: { 'Which?': 'Phone', bad: 3 } })).toEqual({
      answers: { 'Which?': 'Phone' },
    });
    expect(parseRespond({ cancel: true })).toEqual({ cancel: true });
    expect(parseRespond({ allow: true })).toBeNull();
  });
});

// A stand-in for @openai/codex-sdk: it writes the frame file the way a turn
// would and reports the items Codex reports, so nothing reaches a network or
// a real Codex login.
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
        fs.writeFileSync(path.join(opts.workingDirectory, 'prompt.txt'), input);
        const file = path.join(opts.workingDirectory, 'frames', 'landing', 'index.tsx');
        async function* events() {
          yield { type: 'thread.started', thread_id: 'th-1' };
          yield { type: 'item.started', item: { type: 'file_change', id: 'f1', status: 'completed', changes: [{ path: file, kind: 'update' }] } };
          fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('width: 400', 'width: 0'));
          yield { type: 'item.completed', item: { type: 'file_change', id: 'f1', status: 'completed', changes: [{ path: file, kind: 'update' }] } };
          yield { type: 'item.completed', item: { type: 'agent_message', id: 'm1', text: 'Made the hero square.' } };
          yield { type: 'turn.completed', usage: {} };
        }
        return { events: events() };
      },
    };
  }
}
`;

const FRAME = `const Hero = () => <div>Hi</div>;
Hero.frameName = 'Hero';
Hero.size = { width: 400, height: 300 };
export default [Hero];
`;

describe('agent routes', () => {
  let dir: string;
  let server: ViteDevServer;
  let base: string;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'odf-agent-routes-'));
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
    const config = await createViteConfig({ userCwd: dir });
    server = await createServer({
      ...config,
      logLevel: 'silent',
      server: { port: 0, strictPort: false, host: '127.0.0.1', hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? '';
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('lists Codex, connected once its SDK sits in the workspace', async () => {
    const status = (await (await fetch(`${base}/__agent/status`)).json()) as {
      enabled: boolean;
      providers: { id: string; ready: boolean; sdkVersion: string | null }[];
    };
    expect(status.enabled).toBe(true);
    expect(status.providers.map((p) => p.id)).toEqual(['codex']);
    expect(status.providers[0]).toMatchObject({ ready: true, sdkVersion: '0.0.0-fake' });
  });

  it('refuses malformed requests and other origins', async () => {
    expect((await post('/__agent/sessions', { provider: 'claude' })).status).toBe(400);
    expect((await fetch(`${base}/__agent/sessions/s-missing`)).status).toBe(404);
    const session = (await (await post('/__agent/sessions', { provider: 'codex' })).json()) as {
      id: string;
    };
    const res = await post(
      `/__agent/sessions/${session.id}/messages`,
      { text: 'Delete everything' },
      { origin: 'https://elsewhere.example' },
    );
    expect(res.status).toBe(403);
    const plain = await fetch(`${base}/__agent/sessions/${session.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: 'x' }),
    });
    expect(plain.status).toBe(415);
    expect(
      (await fetch(`${base}/__agent/sessions/${session.id}`, { method: 'DELETE' })).status,
    ).toBe(200);
  });

  it('runs a turn, then checks the frame file it changed', async () => {
    const created = (await (
      await post('/__agent/sessions', { provider: 'codex', frameId: 'landing' })
    ).json()) as AgentSession;
    expect(created.frameId).toBe('landing');
    const sent = await post(`/__agent/sessions/${created.id}/messages`, {
      text: 'Make the hero square',
      context: {
        frameId: 'landing',
        artboard: { index: 0, total: 1, name: 'Hero', width: 400, height: 300 },
      },
    });
    expect(sent.status).toBe(202);

    let session: AgentSession | null = null;
    for (let i = 0; i < 100; i++) {
      session = (await (
        await fetch(`${base}/__agent/sessions/${created.id}`)
      ).json()) as AgentSession;
      const check = session.items.find((item) => item.kind === 'check');
      if (check?.kind === 'check' && check.status !== 'running') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(session?.items.map((i) => i.kind)).toEqual([
      'user',
      'tool',
      'assistant',
      'result',
      'check',
    ]);
    const check = session?.items.at(-1);
    expect(check).toMatchObject({
      kind: 'check',
      status: 'done',
      frameIds: ['landing'],
      total: 1,
      findings: [{ frameId: 'landing', rule: 'invalid-size', severity: 'error' }],
    });
    const prompt = readFileSync(path.join(dir, 'prompt.txt'), 'utf8');
    expect(prompt).toContain('open-design-frame dev server');
    expect(prompt).toContain('frames/landing/index.tsx');
    expect(prompt).toContain('<artboard-name>Hero</artboard-name>');

    await server.close();
    const file = path.join(dir, 'node_modules', '.open-design-frame', 'agent-sessions.json');
    // The store saves on close without holding the close up.
    for (let i = 0; i < 40 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 25));
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { sessions: { id: string }[] };
    expect(saved.sessions.some((s) => s.id === created.id)).toBe(true);
  }, 30_000);
});
