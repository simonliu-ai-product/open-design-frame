import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(here, '../dist/stdio.js');
const repoRoot = path.resolve(here, '../../..');
const canRender = existsSync(path.join(repoRoot, 'node_modules', 'playwright'));

/** A newline-delimited JSON-RPC client over the server's stdio. */
function connect(args: string[], cwd: string) {
  const child: ChildProcess = spawn(process.execPath, [bin, ...args], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buf = '';
  let next = 1;
  const pending = new Map<number, (msg: { result?: unknown; error?: unknown }) => void>();
  child.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
      if (msg.id !== undefined) pending.get(msg.id)?.(msg);
    }
  });
  const request = (method: string, params: unknown = {}) =>
    new Promise<{ result?: unknown; error?: unknown }>((resolve) => {
      const id = next++;
      pending.set(id, resolve);
      child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    (await request('tools/call', { name, arguments: args })).result as {
      isError?: boolean;
      content: { type: string; text?: string; data?: string; mimeType?: string }[];
    };
  return {
    async start() {
      await request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      });
      child.stdin?.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
      );
    },
    request,
    call,
    close: () => child.kill(),
  };
}

describe.skipIf(!existsSync(bin))('open-design-frame-mcp over stdio', () => {
  let ws: string;
  let elsewhere: string;
  const clients: { close: () => void }[] = [];

  beforeAll(() => {
    // Inside the repo, so Playwright (a dev dependency here) is found from it.
    ws = mkdtempSync(path.join(here, '.mcp-test-'));
    writeFileSync(
      path.join(ws, 'package.json'),
      JSON.stringify({ dependencies: { '@open-design-frame/core': '*' } }),
    );
    mkdirSync(path.join(ws, 'frames', 'cards'), { recursive: true });
    writeFileSync(
      path.join(ws, 'frames', 'cards', 'index.tsx'),
      `import type { Frame } from '@open-design-frame/core';
const Good: Frame = () => <div style={{ padding: 32 }}>Card</div>;
Good.frameName = 'Good';
Good.size = { width: 320, height: 200 };
const Bad: Frame = () => { throw new Error('no data yet'); };
Bad.frameName = 'Bad';
Bad.size = { width: 320, height: 200 };
export default [Good, Bad];
`,
    );
    elsewhere = mkdtempSync(path.join(tmpdir(), 'odf-not-a-workspace-'));
  });
  afterAll(() => {
    for (const c of clients) c.close();
    rmSync(ws, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  });

  it('refuses every tool until it finds a workspace', async () => {
    const c = connect([], elsewhere);
    clients.push(c);
    await c.start();
    const r = await c.call('list_frames');
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/^412: No open-design-frame workspace/);
  }, 30_000);

  it('finds the workspace from where it was started and lists the new tools', async () => {
    const c = connect([], path.join(ws, 'frames'));
    clients.push(c);
    await c.start();
    const tools = (
      (await c.request('tools/list')).result as { tools: { name: string }[] }
    ).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['check_frames', 'render_frame', 'list_frames']));
    const listed = await c.call('list_frames');
    expect(listed.content[0]?.text).toContain('"cards"');
  }, 30_000);

  it.skipIf(!canRender)(
    'draws frames to check them, and pictures one',
    async () => {
      const c = connect(['--cwd', ws], elsewhere);
      clients.push(c);
      await c.start();
      const checked = JSON.parse(
        (await c.call('check_frames', { render: true })).content[0]?.text ?? '{}',
      ) as {
        ok: boolean;
        reports: { findings: { rule: string; frame?: string; message: string }[] }[];
      };
      expect(checked.ok).toBe(false);
      expect(checked.reports[0]?.findings).toEqual([
        expect.objectContaining({
          rule: 'render-error',
          frame: 'Bad',
          message: expect.stringContaining('no data yet'),
        }),
      ]);
      const pic = await c.call('render_frame', { frameId: 'cards', frame: 'Good' });
      expect(pic.content[0]?.text).toMatch(/Good — 320×200/);
      expect(pic.content[1]).toMatchObject({ type: 'image', mimeType: 'image/png' });
      expect(
        Buffer.from(pic.content[1]?.data ?? '', 'base64')
          .subarray(1, 4)
          .toString(),
      ).toBe('PNG');
      const missing = await c.call('render_frame', { frameId: 'cards', frame: 'Nope' });
      expect(missing).toMatchObject({ isError: true });
      expect(missing.content[0]?.text).toMatch(/^404: .*Good, Bad/);
    },
    60_000,
  );
});
