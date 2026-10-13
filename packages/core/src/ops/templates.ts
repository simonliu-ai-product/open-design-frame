import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setMetaTitle, validateFrameName } from '../editing/frame-ops.ts';
import { FRAME_ID_RE, frameDir, type OpsContext, OpsError } from './context.ts';
import { listFrames } from './frames.ts';

export type TemplateSummary = {
  /** What `--template` takes. */
  name: string;
  title: string;
  description: string;
  category: string;
  /** Shipped with open-design-frame, or written in this workspace's `templates/`. */
  source: 'builtin' | 'workspace';
};

const TEMPLATE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MANIFEST = 'template.json';

function findCoreRoot(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

async function readTemplateDir(
  dir: string,
  name: string,
  source: TemplateSummary['source'],
): Promise<(TemplateSummary & { placeholder?: string }) | null> {
  if (!TEMPLATE_NAME_RE.test(name) || !existsSync(path.join(dir, 'index.tsx'))) return null;
  let manifest: Partial<Record<'title' | 'description' | 'category' | 'placeholder', unknown>> = {};
  try {
    manifest = JSON.parse(await fs.readFile(path.join(dir, MANIFEST), 'utf8'));
  } catch {
    // A folder with an index.tsx is a template even without a manifest.
  }
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return {
    name,
    title: text(manifest.title, name),
    description: text(manifest.description, ''),
    category: text(manifest.category, 'general'),
    source,
    ...(typeof manifest.placeholder === 'string' && manifest.placeholder.trim()
      ? { placeholder: manifest.placeholder.trim() }
      : {}),
  };
}

async function templatesIn(
  root: string | null,
  source: TemplateSummary['source'],
): Promise<Map<string, { dir: string; summary: TemplateSummary & { placeholder?: string } }>> {
  const found = new Map<
    string,
    { dir: string; summary: TemplateSummary & { placeholder?: string } }
  >();
  if (!root || !existsSync(root)) return found;
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const summary = await readTemplateDir(dir, entry.name, source);
    if (summary) found.set(entry.name, { dir, summary });
  }
  return found;
}

async function allTemplates(
  ctx: OpsContext,
): Promise<Map<string, { dir: string; summary: TemplateSummary & { placeholder?: string } }>> {
  const root = findCoreRoot();
  const builtin = await templatesIn(root ? path.join(root, 'templates') : null, 'builtin');
  const workspace = await templatesIn(path.join(ctx.userCwd, 'templates'), 'workspace');
  return new Map([...builtin, ...workspace]);
}

export async function listTemplates(ctx: OpsContext): Promise<TemplateSummary[]> {
  return [...(await allTemplates(ctx)).values()]
    .map(({ summary: { placeholder: _, ...summary } }) => summary)
    .sort(
      (a, b) =>
        Number(a.name === 'blank') - Number(b.name === 'blank') ||
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name),
    );
}

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

export function suggestFrameId(bases: string[], taken: Set<string>): string {
  const slug = bases.map(slugOf).find(Boolean) || 'frame';
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n++) {
    if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
  }
}

export async function createFromTemplate(
  ctx: OpsContext,
  opts: { template: string; frameId?: string; title?: string },
): Promise<{ id: string; file: string }> {
  const template = (await allTemplates(ctx)).get(opts.template);
  if (!template) {
    throw new OpsError(
      404,
      `no template named "${opts.template}" — see \`open-design-frame templates\``,
    );
  }
  const title = opts.title === undefined ? undefined : validateFrameName(opts.title);
  if (opts.title !== undefined && !title) throw new OpsError(400, 'invalid title');

  const existing = await listFrames(ctx);
  const taken = new Set(existing.map((f) => f.id));
  const id = opts.frameId ?? suggestFrameId([title ?? '', template.summary.name], taken);
  if (!FRAME_ID_RE.test(id)) throw new OpsError(400, `invalid frame id: ${id}`);
  if (taken.has(id)) throw new OpsError(409, `frames/${id} already exists`);

  const dir = frameDir(ctx, id);
  await fs.cp(template.dir, dir, {
    recursive: true,
    filter: (src) => path.basename(src) !== MANIFEST,
  });
  const entry = path.join(dir, 'index.tsx');
  let source = await fs.readFile(entry, 'utf8');
  source = source.replace(
    /createdAt:\s*'[^']*'/,
    `createdAt: '${new Date().toISOString().slice(0, 10)}'`,
  );
  if (title) {
    const placeholder = template.summary.placeholder;
    if (placeholder && !/[{}<>'"\\\n]/.test(title)) {
      source = source.split(placeholder).join(title);
    }
    source = setMetaTitle(source, title) ?? source;
  }
  await fs.writeFile(entry, source, 'utf8');
  return { id, file: path.relative(ctx.userCwd, entry) };
}
