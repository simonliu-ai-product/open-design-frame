import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeContext } from './context.ts';
import { createFromTemplate, listTemplates, suggestFrameId } from './templates.ts';

const dirs: string[] = [];

async function tempCtx() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'odf-templates-'));
  dirs.push(dir);
  return makeContext({ userCwd: dir });
}

afterEach(async () => {
  for (const d of dirs.splice(0)) {
    await fs.rm(d, { recursive: true, force: true });
  }
});

describe('templates ops', () => {
  it('lists builtin templates and places blank last', async () => {
    const ctx = await tempCtx();
    const list = await listTemplates(ctx);
    const names = list.map((t) => t.name);
    expect(names).toContain('landing-page');
    expect(names).toContain('mobile-app');
    expect(names).toContain('dashboard-ui');
    expect(names).toContain('social-poster');
    expect(names.at(-1)).toBe('blank');
  });

  it('creates a frame from a template and replaces the title', async () => {
    const ctx = await tempCtx();
    const created = await createFromTemplate(ctx, {
      template: 'landing-page',
      frameId: 'marketing-hero',
      title: 'Acme Launch',
    });
    expect(created.id).toBe('marketing-hero');
    const source = await fs.readFile(path.join(ctx.userCwd, created.file), 'utf8');
    expect(source).toContain("title: 'Acme Launch'");
    expect(source).toContain('Acme Launch');
  });

  it('suggests free ids when a slug is taken', () => {
    const taken = new Set(['landing-page', 'landing-page-2']);
    expect(suggestFrameId(['Landing Page'], taken)).toBe('landing-page-3');
  });
});
