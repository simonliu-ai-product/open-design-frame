import { useCallback, useEffect, useState } from 'react';

export type ChangeHunk = {
  id: string;
  file: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  removed: string[];
  added: string[];
  summary: string;
  loc: string | null;
  tagName: string | null;
  patch: string;
};

export type FrameChanges = {
  frameId: string;
  against: string | null;
  available: boolean;
  hunks: ChangeHunk[];
};

export type RevisionItem = {
  sha: string;
  short: string;
  subject: string;
  date: string;
};

type ApiHunk = {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  removed: string[];
  added: string[];
  targets: { loc: string; mark: string }[];
};

type ApiFileChange = {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  binary: boolean;
  hunks: ApiHunk[];
};

type ApiChangesResponse =
  | { available: false; reason: string; error?: string }
  | {
      available: true;
      since: string;
      commit: string | null;
      files: ApiFileChange[];
      error?: string;
    };

export function useChanges(frameId: string | null, enabled: boolean) {
  const [changes, setChanges] = useState<FrameChanges | null>(null);
  const [revisions, setRevisions] = useState<RevisionItem[]>([]);
  const [against, setAgainst] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (rev = against) => {
      if (!frameId || !enabled || !import.meta.env.DEV) return;
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ frameId });
        if (rev) q.set('since', rev);
        const res = await fetch(`/__changes?${q.toString()}`);
        const body = (await res.json()) as ApiChangesResponse;
        if (!res.ok) {
          setError(body.error ?? `GET /__changes → ${res.status}`);
          return;
        }
        if (!body.available) {
          setChanges({ frameId, against: rev || 'HEAD', available: false, hunks: [] });
          return;
        }
        const hunks: ChangeHunk[] = [];
        for (const file of body.files) {
          for (const h of file.hunks) {
            const firstTarget = h.targets[0];
            hunks.push({
              id: h.id,
              file: file.path,
              oldStart: h.oldStart,
              oldLines: h.oldLines,
              newStart: h.newStart,
              newLines: h.newLines,
              removed: h.removed,
              added: h.added,
              summary: `${firstTarget?.mark ?? file.status} (-${h.removed.length}/+${h.added.length})`,
              loc: firstTarget?.loc ?? null,
              tagName: null,
              patch: '',
            });
          }
        }
        setChanges({
          frameId,
          against: body.since,
          available: true,
          hunks,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [frameId, enabled, against],
  );

  useEffect(() => {
    if (!frameId || !enabled || !import.meta.env.DEV) return;
    let cancelled = false;
    void fetch(`/__changes/revisions?frameId=${encodeURIComponent(frameId)}`)
      .then((r) => r.json())
      .then(
        (data: {
          revisions?: { commit: string; short: string; subject: string; when: string }[];
        }) => {
          if (!cancelled && Array.isArray(data.revisions)) {
            setRevisions(
              data.revisions.map((r) => ({
                sha: r.commit,
                short: r.short,
                subject: r.subject,
                date: r.when,
              })),
            );
          }
        },
      )
      .catch(() => {});
    void reload(against);
    return () => {
      cancelled = true;
    };
  }, [frameId, enabled, against, reload]);

  useEffect(() => {
    if (!import.meta.hot || !enabled) return;
    const onUpdate = () => void reload(against);
    import.meta.hot.on('vite:afterUpdate', onUpdate);
    return () => {
      import.meta.hot?.off('vite:afterUpdate', onUpdate);
    };
  }, [enabled, against, reload]);

  const revert = useCallback(
    async (hunkId: string): Promise<boolean> => {
      if (!frameId || !import.meta.env.DEV) return false;
      const target = changes?.hunks.find((h) => h.id === hunkId);
      if (!target) return false;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/__changes/revert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            frameId,
            file: target.file,
            hunk: hunkId,
            ...(against ? { since: against } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(body.error ?? `POST /__changes/revert → ${res.status}`);
          return false;
        }
        await reload(against);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [frameId, against, changes, reload],
  );

  return {
    changes,
    revisions,
    against,
    setAgainst,
    loading,
    error,
    reload,
    revert,
  };
}
