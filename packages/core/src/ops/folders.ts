import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assignFrame,
  createFolder as create,
  type FoldersManifest,
  type ManifestResult,
  readManifest,
  deleteFolder as remove,
  renameFolder as rename,
} from '../editing/folders.ts';
import { FRAME_ID_RE, type OpsContext, OpsError } from './context.ts';

export const MANIFEST_NAME = '.folders.json';

const manifestPath = (ctx: OpsContext): string => path.join(ctx.framesRoot, MANIFEST_NAME);

export async function readFolders(ctx: OpsContext): Promise<FoldersManifest> {
  try {
    return readManifest(JSON.parse(await fs.readFile(manifestPath(ctx), 'utf8')));
  } catch {
    // No manifest, or one nobody can read: an empty one, not an error. A typo
    // in it should cost the folders, not the page.
    return { folders: [], assignments: {} };
  }
}

export async function writeFolders(ctx: OpsContext, manifest: FoldersManifest): Promise<void> {
  await fs.mkdir(ctx.framesRoot, { recursive: true });
  await fs.writeFile(manifestPath(ctx), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function commit(ctx: OpsContext, result: ManifestResult): Promise<FoldersManifest> {
  if (!result.ok) throw new OpsError(result.status, result.error);
  await writeFolders(ctx, result.manifest);
  return result.manifest;
}

export async function createFolder(ctx: OpsContext, name: unknown): Promise<FoldersManifest> {
  return commit(ctx, create(await readFolders(ctx), name));
}

export async function renameFolder(
  ctx: OpsContext,
  folderId: string,
  name: unknown,
): Promise<FoldersManifest> {
  return commit(ctx, rename(await readFolders(ctx), folderId, name));
}

export async function deleteFolder(ctx: OpsContext, folderId: string): Promise<FoldersManifest> {
  return commit(ctx, remove(await readFolders(ctx), folderId));
}

export async function assignFrameToFolder(
  ctx: OpsContext,
  frameId: string,
  folderId: string | null,
): Promise<FoldersManifest> {
  if (!FRAME_ID_RE.test(frameId)) {
    throw new OpsError(400, 'frameId must be lowercase words joined by hyphens');
  }
  return commit(ctx, assignFrame(await readFolders(ctx), frameId, folderId));
}
