import { randomUUID } from 'node:crypto';

export type Folder = { id: string; name: string };
export type FoldersManifest = { folders: Folder[]; assignments: Record<string, string> };

export const EMPTY_MANIFEST: FoldersManifest = { folders: [], assignments: {} };

const FOLDER_ID_RE = /^f-[a-f0-9]{8}$/;
const MAX_NAME = 60;

export type ManifestResult =
  | { ok: true; manifest: FoldersManifest }
  | { ok: false; status: number; error: string };

export function newFolderId(): string {
  return `f-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

/**
 * Whatever is on disk, read as a manifest.
 *
 * The file is a plain JSON file an author may edit by hand, so anything
 * unreadable becomes an empty manifest rather than an error — a typo in it
 * should cost the folders, not the home page.
 */
export function readManifest(raw: unknown): FoldersManifest {
  if (typeof raw !== 'object' || raw === null) return { folders: [], assignments: {} };
  const value = raw as { folders?: unknown; assignments?: unknown };
  const folders: Folder[] = [];
  if (Array.isArray(value.folders)) {
    for (const entry of value.folders) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { id, name } = entry as { id?: unknown; name?: unknown };
      if (typeof id !== 'string' || !FOLDER_ID_RE.test(id)) continue;
      if (typeof name !== 'string' || name.trim() === '') continue;
      if (folders.some((f) => f.id === id)) continue;
      folders.push({ id, name: name.slice(0, MAX_NAME) });
    }
  }
  const known = new Set(folders.map((f) => f.id));
  const assignments: Record<string, string> = {};
  if (typeof value.assignments === 'object' && value.assignments !== null) {
    for (const [frameId, folderId] of Object.entries(value.assignments)) {
      // A frame assigned to a folder that is gone is unfiled, not lost.
      if (typeof folderId === 'string' && known.has(folderId)) assignments[frameId] = folderId;
    }
  }
  return { folders, assignments };
}

function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed === '' ? null : trimmed.slice(0, MAX_NAME);
}

export function createFolder(manifest: FoldersManifest, name: unknown): ManifestResult {
  const clean = cleanName(name);
  if (clean === null) return { ok: false, status: 400, error: 'a folder needs a name' };
  if (manifest.folders.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, status: 409, error: `there is already a folder called ${clean}` };
  }
  const folder = { id: newFolderId(), name: clean };
  return { ok: true, manifest: { ...manifest, folders: [...manifest.folders, folder] } };
}

export function renameFolder(manifest: FoldersManifest, id: string, name: unknown): ManifestResult {
  const clean = cleanName(name);
  if (clean === null) return { ok: false, status: 400, error: 'a folder needs a name' };
  if (!manifest.folders.some((f) => f.id === id)) {
    return { ok: false, status: 404, error: 'no such folder' };
  }
  return {
    ok: true,
    manifest: {
      ...manifest,
      folders: manifest.folders.map((f) => (f.id === id ? { ...f, name: clean } : f)),
    },
  };
}

/** Deleting a folder unfiles its frames; nothing on disk moves. */
export function deleteFolder(manifest: FoldersManifest, id: string): ManifestResult {
  if (!manifest.folders.some((f) => f.id === id)) {
    return { ok: false, status: 404, error: 'no such folder' };
  }
  const assignments = Object.fromEntries(
    Object.entries(manifest.assignments).filter(([, folderId]) => folderId !== id),
  );
  return {
    ok: true,
    manifest: { folders: manifest.folders.filter((f) => f.id !== id), assignments },
  };
}

export function assignFrame(
  manifest: FoldersManifest,
  frameId: string,
  folderId: string | null,
): ManifestResult {
  if (folderId !== null && !manifest.folders.some((f) => f.id === folderId)) {
    return { ok: false, status: 404, error: 'no such folder' };
  }
  const assignments = { ...manifest.assignments };
  if (folderId === null) delete assignments[frameId];
  else assignments[frameId] = folderId;
  return { ok: true, manifest: { ...manifest, assignments } };
}
