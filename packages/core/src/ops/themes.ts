import fs from 'node:fs/promises';
import path from 'node:path';
import { FRAME_ID_RE, type OpsContext, OpsError } from './context.ts';

export type ThemeEntry = { id: string; file: string; doc: string | null; source?: string };

const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false,
  );

/**
 * A theme is one file, or a folder with an `index` in it.
 *
 * The folder form exists so a `DESIGN.md` can sit beside the tokens — the
 * document and the values it describes go stale together or not at all. Both
 * shapes import the same way, `themes/<id>`.
 */
async function themeFile(ctx: OpsContext, themeId: string): Promise<string> {
  if (!FRAME_ID_RE.test(themeId)) throw new OpsError(400, `'${themeId}' is not a theme id`);
  for (const ext of EXTS) {
    const flat = path.join(ctx.themesRoot, `${themeId}${ext}`);
    if (await exists(flat)) return flat;
    const nested = path.join(ctx.themesRoot, themeId, `index${ext}`);
    if (await exists(nested)) return nested;
  }
  throw new OpsError(404, `no theme named ${themeId}`);
}

/** Where the design document for a theme lives, whichever shape the theme is. */
export async function themeDocPath(ctx: OpsContext, themeId: string): Promise<string> {
  const file = await themeFile(ctx, themeId);
  const dir = path.dirname(file);
  return dir === ctx.themesRoot
    ? path.join(ctx.themesRoot, `${themeId}.md`)
    : path.join(dir, 'DESIGN.md');
}

export async function listThemes(ctx: OpsContext): Promise<ThemeEntry[]> {
  const entries = await fs.readdir(ctx.themesRoot, { withFileTypes: true }).catch(() => []);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.isFile()) {
      const id = entry.name.replace(/\.[jt]sx?$/, '');
      if (id !== entry.name && FRAME_ID_RE.test(id)) ids.add(id);
    } else if (entry.isDirectory() && FRAME_ID_RE.test(entry.name)) {
      for (const ext of EXTS) {
        if (await exists(path.join(ctx.themesRoot, entry.name, `index${ext}`))) {
          ids.add(entry.name);
          break;
        }
      }
    }
  }

  const out: ThemeEntry[] = [];
  for (const id of [...ids].sort()) {
    const file = await themeFile(ctx, id);
    const doc = await themeDocPath(ctx, id);
    out.push({
      id,
      file: path.relative(ctx.userCwd, file),
      doc: (await exists(doc)) ? path.relative(ctx.userCwd, doc) : null,
    });
  }
  return out;
}

export async function readTheme(ctx: OpsContext, themeId: string): Promise<ThemeEntry> {
  const file = await themeFile(ctx, themeId);
  const doc = await themeDocPath(ctx, themeId);
  return {
    id: themeId,
    file: path.relative(ctx.userCwd, file),
    doc: (await exists(doc)) ? path.relative(ctx.userCwd, doc) : null,
    source: await fs.readFile(file, 'utf8'),
  };
}

/** The theme's DESIGN.md — the prose half of a design system, for people and agents. */
export async function readThemeDoc(
  ctx: OpsContext,
  themeId: string,
): Promise<{ id: string; file: string; markdown: string }> {
  const doc = await themeDocPath(ctx, themeId);
  const markdown = await fs.readFile(doc, 'utf8').catch(() => null);
  if (markdown === null) throw new OpsError(404, `${themeId} has no design document yet`);
  return { id: themeId, file: path.relative(ctx.userCwd, doc), markdown };
}

export async function writeThemeDoc(
  ctx: OpsContext,
  themeId: string,
  markdown: string,
): Promise<{ id: string; file: string }> {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    throw new OpsError(400, 'a design document needs something in it');
  }
  const doc = await themeDocPath(ctx, themeId);
  await fs.mkdir(path.dirname(doc), { recursive: true });
  await fs.writeFile(doc, markdown, 'utf8');
  return { id: themeId, file: path.relative(ctx.userCwd, doc) };
}

export async function writeTheme(
  ctx: OpsContext,
  themeId: string,
  source: string,
): Promise<{ id: string; file: string }> {
  if (!FRAME_ID_RE.test(themeId)) throw new OpsError(400, `'${themeId}' is not a theme id`);
  if (typeof source !== 'string' || source.trim() === '') {
    throw new OpsError(400, 'a theme needs source to write');
  }
  await fs.mkdir(ctx.themesRoot, { recursive: true });
  const file = path.join(ctx.themesRoot, `${themeId}.ts`);
  await fs.writeFile(file, source, 'utf8');
  return { id: themeId, file: path.relative(ctx.userCwd, file) };
}
