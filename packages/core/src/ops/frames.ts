import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyEdit, type EditOp } from '../editing/edit-ops.ts';
import {
  type FileSummary,
  nextCopyId,
  readFileSummary,
  setMetaTitle,
  validateFrameName,
} from '../editing/frame-ops.ts';
import { ENTRY_NAMES, FRAME_ID_RE, frameDir, type OpsContext, OpsError } from './context.ts';
import { assignFrameToFolder, readFolders } from './folders.ts';

export type FrameEntry = FileSummary & {
  id: string;
  file: string;
  folderId: string | null;
  /** Of the current source. Pass it back to write and a stale edit is refused. */
  revision: string;
};

const revisionOf = (source: string): string =>
  createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 12);

async function entryFile(dir: string): Promise<string | null> {
  for (const name of ENTRY_NAMES) {
    const candidate = path.join(dir, name);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

export async function frameFile(ctx: OpsContext, frameId: unknown): Promise<string> {
  const file = await entryFile(frameDir(ctx, frameId));
  if (file === null) throw new OpsError(404, `no source for frames/${String(frameId)}`);
  return file;
}

export async function listFrames(ctx: OpsContext): Promise<FrameEntry[]> {
  const dirs = await fs.readdir(ctx.framesRoot, { withFileTypes: true }).catch(() => []);
  const manifest = await readFolders(ctx);
  const out: FrameEntry[] = [];
  for (const entry of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !FRAME_ID_RE.test(entry.name)) continue;
    const file = await entryFile(path.join(ctx.framesRoot, entry.name));
    if (file === null) continue;
    const source = await fs.readFile(file, 'utf8');
    out.push({
      id: entry.name,
      file: path.relative(ctx.userCwd, file),
      folderId: manifest.assignments[entry.name] ?? null,
      revision: revisionOf(source),
      ...readFileSummary(source),
    });
  }
  return out;
}

export async function readFrame(
  ctx: OpsContext,
  frameId: string,
): Promise<{ id: string; file: string; revision: string; source: string }> {
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  return {
    id: frameId,
    file: path.relative(ctx.userCwd, file),
    revision: revisionOf(source),
    source,
  };
}

/**
 * Replace a frame's source.
 *
 * `revision` is the one that was read. A write against an older one is refused
 * rather than applied, because the other half of this workspace is a person
 * with the file open — overwriting their edit silently is the one failure that
 * cannot be undone from here.
 */
export async function writeFrame(
  ctx: OpsContext,
  frameId: string,
  source: string,
  revision?: string,
): Promise<{ id: string; revision: string; bytes: number }> {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new OpsError(400, 'a frame needs source to write');
  }
  const file = await frameFile(ctx, frameId);
  const current = await fs.readFile(file, 'utf8');
  if (revision !== undefined && revision !== revisionOf(current)) {
    throw new OpsError(409, `frames/${frameId} changed since you read it — read it again`);
  }
  await fs.writeFile(file, source, 'utf8');
  return { id: frameId, revision: revisionOf(source), bytes: Buffer.byteLength(source, 'utf8') };
}

const STARTER = (
  title: string,
) => `import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';

export const meta: FrameMeta = { title: ${JSON.stringify(title)}, createdAt: '${new Date().toISOString().slice(0, 10)}' };

const Screen: Frame = () => (
  <Layer name="Page" style={{ width: '100%', height: '100%', padding: 72 }}>
    <Layer name="Title" kind="text" as="span" style={{ fontSize: 'var(--odf-size-hero)' }}>
      ${title}
    </Layer>
  </Layer>
);

Screen.frameName = 'Screen · Desktop';
Screen.size = SIZES.DESKTOP;

export default [Screen];
`;

export async function createFrame(
  ctx: OpsContext,
  frameId: string,
  title?: string,
): Promise<{ id: string; file: string }> {
  const dir = frameDir(ctx, frameId);
  const existing = await entryFile(dir);
  if (existing !== null) throw new OpsError(409, `frames/${frameId} already exists`);
  const name = validateFrameName(title ?? frameId) ?? frameId;
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'index.tsx');
  await fs.writeFile(file, STARTER(name), 'utf8');
  return { id: frameId, file: path.relative(ctx.userCwd, file) };
}

/** The title, not the folder: the folder name is the id, and the id is in the URL. */
export async function renameFrame(
  ctx: OpsContext,
  frameId: string,
  title: unknown,
): Promise<{ id: string; title: string }> {
  const name = validateFrameName(title);
  if (name === null) throw new OpsError(400, 'a frame needs a name, up to 80 characters');
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  const updated = setMetaTitle(source, name);
  if (updated === null)
    throw new OpsError(422, 'could not find where this frame declares its meta');
  if (updated !== source) await fs.writeFile(file, updated, 'utf8');
  return { id: frameId, title: name };
}

export async function duplicateFrame(
  ctx: OpsContext,
  frameId: string,
  newId?: string,
): Promise<{ id: string }> {
  const dir = frameDir(ctx, frameId);
  await frameFile(ctx, frameId);
  const taken = (await fs.readdir(ctx.framesRoot, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const copyId = newId ?? nextCopyId(frameId, taken);
  if (taken.includes(copyId)) throw new OpsError(409, `frames/${copyId} already exists`);
  const copyDir = frameDir(ctx, copyId);
  await fs.cp(dir, copyDir, { recursive: true });

  const manifest = await readFolders(ctx);
  const folderId = manifest.assignments[frameId];
  if (folderId) await assignFrameToFolder(ctx, copyId, folderId);
  return { id: copyId };
}

export async function deleteFrame(ctx: OpsContext, frameId: string): Promise<{ ok: true }> {
  const dir = frameDir(ctx, frameId);
  const gone = await fs.rm(dir, { recursive: true }).then(
    () => true,
    () => false,
  );
  if (!gone) throw new OpsError(404, `no frames/${frameId}`);
  const manifest = await readFolders(ctx);
  if (manifest.assignments[frameId]) await assignFrameToFolder(ctx, frameId, null);
  return { ok: true };
}

/**
 * One element's style or text, addressed by where it is written.
 *
 * The location comes from `data-odf-loc` in the running page, so an agent that
 * can see the DOM edits exactly what a person would have clicked.
 */
export async function editElement(
  ctx: OpsContext,
  frameId: string,
  line: number,
  column: number,
  ops: EditOp[],
): Promise<{ changed: boolean }> {
  if (!Array.isArray(ops) || ops.length === 0) throw new OpsError(400, 'no edits given');
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  const result = applyEdit(source, line, column, ops);
  if (!result.ok) throw new OpsError(result.status, result.error);
  if (result.changed) await fs.writeFile(file, result.source, 'utf8');
  return { changed: result.changed };
}
