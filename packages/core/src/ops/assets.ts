import fs from 'node:fs/promises';
import path from 'node:path';
import { ENTRY_NAMES, FRAME_ID_RE, type OpsContext, OpsError } from './context.ts';

export const GLOBAL_SCOPE = '@global';

/**
 * A filename that is only a filename.
 *
 * These land on the author's disk under a folder we chose, so the name must not
 * be able to climb out of it: no separators, no `..`, no leading dot to hide
 * the file from the listing that is supposed to show it.
 */
export const SAFE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

export const typeOf = (name: string): string =>
  TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream';

export type Asset = {
  name: string;
  scope: string;
  bytes: number;
  type: string;
  updatedAt: string;
  url: string;
  usedBy: string[];
};

export function scopeFolder(ctx: OpsContext, scope: string): string {
  if (scope === GLOBAL_SCOPE) return ctx.assetsRoot;
  if (!FRAME_ID_RE.test(scope)) throw new OpsError(400, `unknown scope '${scope}'`);
  return path.join(ctx.framesRoot, scope, 'assets');
}

export function assetPath(ctx: OpsContext, scope: string, name: string): string {
  if (!SAFE_NAME_RE.test(name)) throw new OpsError(400, 'a file name may not contain a path');
  return path.join(scopeFolder(ctx, scope), name);
}

/**
 * Which frames mention each file, by name.
 *
 * A path in a frame is written by hand, so the honest question is not "what did
 * we record" but "does any source say this name". It is a text search, and a
 * file named `logo.png` in two scopes answers for both.
 */
async function frameSources(ctx: OpsContext): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const entries = await fs.readdir(ctx.framesRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const name of ENTRY_NAMES) {
      const source = await fs
        .readFile(path.join(ctx.framesRoot, entry.name, name), 'utf8')
        .catch(() => null);
      if (source !== null) {
        out.set(entry.name, source);
        break;
      }
    }
  }
  return out;
}

async function listFolder(
  dir: string,
  scope: string,
  sources: Map<string, string>,
): Promise<Asset[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (entries === null) return [];
  const out: Asset[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const stat = await fs.stat(path.join(dir, entry.name));
    out.push({
      name: entry.name,
      scope,
      bytes: stat.size,
      type: typeOf(entry.name),
      updatedAt: stat.mtime.toISOString(),
      url: `/__assets/${scope}/${encodeURIComponent(entry.name)}`,
      usedBy: [...sources].filter(([, src]) => src.includes(entry.name)).map(([id]) => id),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAssets(ctx: OpsContext, scope?: string): Promise<Asset[]> {
  const sources = await frameSources(ctx);
  if (scope !== undefined) return listFolder(scopeFolder(ctx, scope), scope, sources);

  const frames = await fs.readdir(ctx.framesRoot, { withFileTypes: true }).catch(() => []);
  const all = await listFolder(ctx.assetsRoot, GLOBAL_SCOPE, sources);
  for (const entry of frames) {
    if (!entry.isDirectory() || !FRAME_ID_RE.test(entry.name)) continue;
    all.push(...(await listFolder(scopeFolder(ctx, entry.name), entry.name, sources)));
  }
  return all;
}

export async function readAsset(
  ctx: OpsContext,
  scope: string,
  name: string,
): Promise<{ bytes: Buffer; type: string }> {
  const bytes = await fs.readFile(assetPath(ctx, scope, name)).catch(() => null);
  if (!bytes) throw new OpsError(404, `no asset named ${name}`);
  return { bytes, type: typeOf(name) };
}

export async function writeAsset(
  ctx: OpsContext,
  scope: string,
  name: string,
  bytes: Buffer,
): Promise<{ name: string; scope: string; bytes: number }> {
  const file = assetPath(ctx, scope, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return { name, scope, bytes: bytes.length };
}

export async function deleteAsset(
  ctx: OpsContext,
  scope: string,
  name: string,
): Promise<{ ok: true }> {
  const gone = await fs.rm(assetPath(ctx, scope, name)).then(
    () => true,
    () => false,
  );
  if (!gone) throw new OpsError(404, `no asset named ${name}`);
  return { ok: true };
}
