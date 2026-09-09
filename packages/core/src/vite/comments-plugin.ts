import type { Plugin } from 'vite';
import { createComment, deleteComment, listComments, type OpsContext } from '../ops/index.ts';
import { readJson, send } from './http.ts';

type AddBody = { frameId?: unknown; line?: unknown; column?: unknown; note?: unknown };

/** Notes on a frame, kept in the frame's own file. Dev only. */
export function commentsPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-frame:comments',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__comments', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = req.method ?? 'GET';
        const frameId = url.searchParams.get('frameId') ?? '';

        if (method === 'GET') {
          void send(res, async () => ({ comments: await listComments(ctx, frameId) }));
          return;
        }
        if (method === 'POST') {
          void send(res, async () => {
            const body = (await readJson(req)) as AddBody;
            if (typeof body.line !== 'number' || typeof body.column !== 'number') {
              throw new Error('line and column are required');
            }
            return createComment(
              ctx,
              String(body.frameId),
              body.line,
              body.column,
              String(body.note ?? ''),
            );
          });
          return;
        }
        if (method === 'DELETE') {
          const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
          void send(res, () => deleteComment(ctx, frameId, id));
          return;
        }
        next();
      });
    },
  };
}
