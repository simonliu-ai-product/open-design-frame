import type { Plugin, ViteDevServer } from 'vite';
import {
  createFrame,
  deleteFrame,
  duplicateFrame,
  type OpsContext,
  renameFrame,
  writeFrame,
} from '../ops/index.ts';
import { readJson, send } from './http.ts';

/**
 * The frame itself: created, renamed, copied, deleted.
 *
 * A rename writes `meta.title` and leaves the folder alone — the folder name is
 * the id, and the id is in the URL, in the asset paths beside it and in
 * whatever links to it.
 */
export function framesPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-frame:frames',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__frames', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = req.method ?? 'GET';
        const [id = '', action] = url.pathname.split('/').filter(Boolean);

        if (method === 'POST' && id === '') {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as {
              id?: unknown;
              title?: unknown;
            };
            return createFrame(ctx, String(body.id), body.title ? String(body.title) : undefined);
          });
          return;
        }
        if (method === 'PATCH' && id !== '' && action === undefined) {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as {
              name?: unknown;
              source?: unknown;
              revision?: unknown;
            };
            if (typeof body.source === 'string') {
              return writeFrame(
                ctx,
                id,
                body.source,
                typeof body.revision === 'string' ? body.revision : undefined,
              );
            }
            const renamed = await renameFrame(ctx, id, body.name);
            // The title lives in a module the home page loaded once; HMR
            // replaces the module but not the copy that page is holding.
            server.ws.send({ type: 'full-reload' });
            return renamed;
          });
          return;
        }
        if (method === 'POST' && action === 'duplicate') {
          void send(res, () => duplicateFrame(ctx, id));
          return;
        }
        if (method === 'DELETE' && id !== '' && action === undefined) {
          void send(res, () => deleteFrame(ctx, id));
          return;
        }
        next();
      });
    },
  };
}
