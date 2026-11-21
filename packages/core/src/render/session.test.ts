import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeContext } from '../ops/context.ts';
import { closeRenderSessions, renderCheck, renderFrameImage } from './session.ts';

// A workspace inside the repo, so Playwright (a dev dependency here) is found walking up from it.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const hasPlaywright = existsSync(path.join(repoRoot, 'node_modules', 'playwright'));
const hasBuild = existsSync(path.resolve(here, '../../dist/index.js'));

const HEADER = `import type { Frame } from '@open-design-frame/core';\n`;
const FILES: Record<string, string> = {
  good: `${HEADER}
const A: Frame = () => <div style={{ padding: 40, fontSize: 24 }}>Hello</div>;
A.frameName = 'Hello';
A.size = { width: 400, height: 300 };
const B: Frame = () => <div style={{ padding: 40, background: '#0a7', height: '100%' }}>Second</div>;
B.frameName = 'Second';
B.size = { width: 200, height: 100 };
export default [A, B];
`,
  throws: `${HEADER}
const items: string[] | undefined = undefined;
const A: Frame = () => <ul>{items!.map((i) => <li key={i}>{i}</li>)}</ul>;
A.frameName = 'Broken';
A.size = { width: 400, height: 300 };
const B: Frame = () => <p style={{ padding: 20 }}>Still fine</p>;
B.frameName = 'Fine';
B.size = { width: 400, height: 300 };
export default [A, B];
`,
  layout: `${HEADER}
const A: Frame = () => (
  <div style={{ padding: 20 }}>
    <p>Wide</p>
    <div style={{ width: 900, height: 40, background: '#c33' }}>too wide</div>
    <img src="/assets/not-there.png" alt="" width={50} height={50} />
  </div>
);
A.frameName = 'Layout';
A.size = { width: 400, height: 300 };
export default [A];
`,
  syntax: `${HEADER}
const A: Frame = () => <div>unclosed;
export default [A];
`,
};

describe.skipIf(!hasPlaywright || !hasBuild)('rendering frames headlessly', () => {
  let dir: string;
  let ctx: ReturnType<typeof makeContext>;

  beforeAll(() => {
    dir = mkdtempSync(path.join(here, '.render-test-'));
    for (const [id, source] of Object.entries(FILES)) {
      mkdirSync(path.join(dir, 'frames', id), { recursive: true });
      writeFileSync(path.join(dir, 'frames', id, 'index.tsx'), source);
    }
    ctx = makeContext({ userCwd: dir });
  });
  afterAll(async () => {
    await closeRenderSessions();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a clean file frame by frame', async () => {
    const r = await renderCheck(ctx, 'good');
    expect(r.error).toBeUndefined();
    expect(r.frames.map((f) => [f.name, f.width, f.height, f.findings.length])).toEqual([
      ['Hello', 400, 300, 0],
      ['Second', 200, 100, 0],
    ]);
  }, 60_000);

  it('keeps a frame that throws on its own artboard and says why', async () => {
    const r = await renderCheck(ctx, 'throws');
    expect(r.frames[0]?.findings).toEqual([
      expect.objectContaining({
        rule: 'render-error',
        severity: 'error',
        message: expect.stringMatching(/map/),
      }),
    ]);
    expect(r.frames[1]?.findings).toEqual([]);
  }, 60_000);

  it('finds overflow and an image that does not load', async () => {
    const rules = (await renderCheck(ctx, 'layout')).frames[0]?.findings.map((f) => f.rule);
    expect(rules).toContain('frame-overflow');
    expect(rules).toContain('broken-image');
  }, 60_000);

  it('reports a file that does not load at all', async () => {
    const r = await renderCheck(ctx, 'syntax');
    expect(r.frames).toEqual([]);
    expect(r.error).toBeTruthy();
  }, 60_000);

  it('takes a picture of one frame by name, at its own size', async () => {
    const pic = await renderFrameImage(ctx, 'good', 'Second', { scale: 2 });
    expect(pic).toMatchObject({ name: 'Second', width: 200, height: 100 });
    // PNG header, then the IHDR width and height at 2x.
    const png = Buffer.from(pic.png);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([400, 200]);
    await expect(renderFrameImage(ctx, 'good', 'Nope')).rejects.toThrow(/Hello, Second/);
  }, 60_000);
});
