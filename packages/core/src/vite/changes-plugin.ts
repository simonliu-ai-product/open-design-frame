import type { Plugin } from 'vite';
import { listRevisions, type OpsContext, readChanges, revertChange } from '../ops/index.ts';
import { readJson, send } from './http.ts';

type RevertBody = { frameId?: unknown; since?: unknown; file?: unknown; hunk?: unknown };

/** Git changes and hunk revert for a frame. Dev only. */
export function changesPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-design-frame:changes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__changes', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = req.method ?? 'GET';
        const frameId = url.searchParams.get('frameId') ?? '';

        if (method === 'GET' && url.pathname === '/revisions') {
          void send(res, async () => ({ revisions: await listRevisions(ctx, frameId) }));
          return;
        }
        if (method === 'GET') {
          const since = url.searchParams.get('since') ?? 'HEAD';
          void send(res, () => readChanges(ctx, frameId, since));
          return;
        }
        if (method === 'POST' && url.pathname === '/revert') {
          void send(res, async () => {
            const body = (await readJson(req)) as RevertBody;
            return revertChange(ctx, String(body.frameId ?? ''), {
              ...(typeof body.since === 'string' && body.since ? { since: body.since } : {}),
              file: String(body.file ?? ''),
              hunk: String(body.hunk ?? ''),
            });
          });
          return;
        }
        next();
      });
    },
  };
}
