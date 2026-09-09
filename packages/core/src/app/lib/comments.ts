import { useCallback, useEffect, useState } from 'react';

export type FrameComment = { id: string; line: number; ts: string; note: string };

/**
 * Notes on a frame, read from and written to its source file.
 *
 * Dev only — there is no server to ask in a static build, so the dock that uses
 * this is not rendered there rather than showing an empty list that can never
 * fill.
 */
export function useComments(frameId: string | null) {
  const [comments, setComments] = useState<FrameComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (frameId === null) return;
    try {
      const res = await fetch(`/__comments?frameId=${encodeURIComponent(frameId)}`);
      const body = (await res.json().catch(() => ({}))) as {
        comments?: FrameComment[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `GET /__comments → ${res.status}`);
        return;
      }
      setComments(body.comments ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [frameId]);

  const add = useCallback(
    async (line: number, column: number, note: string) => {
      const res = await fetch('/__comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ frameId, line, column, note }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `POST /__comments → ${res.status}`);
        return false;
      }
      await refetch();
      return true;
    },
    [frameId, refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/__comments/${id}?frameId=${encodeURIComponent(frameId ?? '')}`, {
        method: 'DELETE',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `DELETE /__comments/${id} → ${res.status}`);
        return;
      }
      await refetch();
    },
    [frameId, refetch],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // The marker lives in the file, so the file changing is the list changing.
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => void refetch();
    import.meta.hot.on('vite:afterUpdate', handler);
    return () => import.meta.hot?.off('vite:afterUpdate', handler);
  }, [refetch]);

  return { comments, error, add, remove, refetch };
}
