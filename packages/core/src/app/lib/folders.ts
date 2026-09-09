import snapshot from 'virtual:open-design-frame/folders';
import { useCallback, useEffect, useState } from 'react';
import type { FoldersManifest } from '../../editing/folders.ts';

export type { Folder, FoldersManifest } from '../../editing/folders.ts';

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** Folders are a label on a frame, not a directory: no file moves when one does. */
export function useFolders() {
  const [manifest, setManifest] = useState<FoldersManifest>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const editable = import.meta.env.DEV;

  const refetch = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    try {
      const res = await fetch('/__folders');
      if (!res.ok) {
        setError(`GET /__folders → ${res.status}`);
        return;
      }
      setManifest((await res.json()) as FoldersManifest);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const send = useCallback(async (path: string, init: RequestInit): Promise<boolean> => {
    const res = await fetch(`/__folders${path}`, init);
    const body = (await res.json().catch(() => ({}))) as FoldersManifest & { error?: string };
    if (!res.ok) {
      setError(body.error ?? `${init.method} /__folders${path} → ${res.status}`);
      return false;
    }
    setManifest({ folders: body.folders ?? [], assignments: body.assignments ?? {} });
    setError(null);
    return true;
  }, []);

  const create = useCallback((name: string) => send('', jsonInit('POST', { name })), [send]);
  const rename = useCallback(
    (id: string, name: string) => send(`/${id}`, jsonInit('PATCH', { name })),
    [send],
  );
  const remove = useCallback((id: string) => send(`/${id}`, { method: 'DELETE' }), [send]);
  const assign = useCallback(
    (frameId: string, folderId: string | null) =>
      send('/assign', jsonInit('PUT', { frameId, folderId })),
    [send],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { manifest, error, editable, create, rename, remove, assign };
}
