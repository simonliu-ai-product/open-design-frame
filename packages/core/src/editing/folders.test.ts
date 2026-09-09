import { describe, expect, it } from 'vitest';
import {
  assignFrame,
  createFolder,
  deleteFolder,
  type FoldersManifest,
  readManifest,
  renameFolder,
} from './folders.ts';

function withFolder(name = 'Marketing'): { manifest: FoldersManifest; id: string } {
  const out = createFolder({ folders: [], assignments: {} }, name);
  if (!out.ok) throw new Error(out.error);
  const id = out.manifest.folders[0]?.id ?? '';
  return { manifest: out.manifest, id };
}

describe('reading the manifest', () => {
  it('takes nothing on trust', () => {
    const manifest = readManifest({
      folders: [
        { id: 'f-0011aabb', name: 'Keep' },
        { id: 'not-an-id', name: 'Dropped' },
        { id: 'f-0022ccdd', name: '   ' },
      ],
      assignments: { keep: 'f-0011aabb', orphan: 'f-9999ffff', wrong: 7 },
    });
    expect(manifest.folders).toEqual([{ id: 'f-0011aabb', name: 'Keep' }]);
    expect(manifest.assignments).toEqual({ keep: 'f-0011aabb' });
  });

  it('reads a file that is not a manifest as an empty one', () => {
    expect(readManifest('nonsense')).toEqual({ folders: [], assignments: {} });
    expect(readManifest(null)).toEqual({ folders: [], assignments: {} });
  });
});

describe('folders', () => {
  it('creates one with a tidied name', () => {
    const out = createFolder({ folders: [], assignments: {} }, '  Brand   assets ');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.manifest.folders[0]?.name).toBe('Brand assets');
  });

  it('refuses a name that is already taken', () => {
    const { manifest } = withFolder('Marketing');
    const out = createFolder(manifest, 'marketing');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(409);
  });

  it('refuses a name that is only space', () => {
    const out = createFolder({ folders: [], assignments: {} }, '  ');
    expect(out.ok).toBe(false);
  });

  it('renames one', () => {
    const { manifest, id } = withFolder();
    const out = renameFolder(manifest, id, 'Campaigns');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.manifest.folders[0]?.name).toBe('Campaigns');
  });

  it('reports a rename of something that is not there', () => {
    const out = renameFolder({ folders: [], assignments: {} }, 'f-0011aabb', 'Nope');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(404);
  });

  /* Deleting a folder must not look like deleting what is in it. */
  it('unfiles the frames in one it deletes', () => {
    const { manifest, id } = withFolder();
    const assigned = assignFrame(manifest, 'flow-dashboard', id);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const out = deleteFolder(assigned.manifest, id);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.manifest.folders).toEqual([]);
    expect(out.manifest.assignments).toEqual({});
  });
});

describe('assigning a frame', () => {
  it('moves it in and back out again', () => {
    const { manifest, id } = withFolder();
    const into = assignFrame(manifest, 'onboarding', id);
    expect(into.ok).toBe(true);
    if (!into.ok) return;
    expect(into.manifest.assignments.onboarding).toBe(id);

    const out = assignFrame(into.manifest, 'onboarding', null);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.manifest.assignments.onboarding).toBeUndefined();
  });

  it('refuses a folder that does not exist', () => {
    const out = assignFrame({ folders: [], assignments: {} }, 'onboarding', 'f-0011aabb');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(404);
  });
});
