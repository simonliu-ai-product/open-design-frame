import type { Plugin } from 'vite';
import { deleteAsset, listAssets, type OpsContext, readAsset, writeAsset } from '../ops/index.ts';
import { json, readBytes, send } from './http.ts';

const MAX_UPLOAD = 25 * 1024 * 1024;

/**
 * The files a frame draws with, on the author's disk.
 *
 * Two scopes, because both are real: something used by one frame belongs beside
 * it in `frames/<id>/assets/`, and something used by all of them belongs in the
 * project's own `assets/`. Nothing is copied between them.
 */
export function assetsPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-frame:assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__assets', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const [scope, name] = parts;
        const method = req.method ?? 'GET';

        if (scope === undefined) {
          void send(res, async () => ({ assets: await listAssets(ctx) }));
          return;
        }
        if (name === undefined) {
          if (method !== 'GET') return json(res, 405, { error: 'GET only' });
          void send(res, async () => ({ scope, assets: await listAssets(ctx, scope) }));
          return;
        }

        if (method === 'GET') {
          void (async () => {
            try {
              const asset = await readAsset(ctx, scope, name);
              res.statusCode = 200;
              res.setHeader('content-type', asset.type);
              // The bytes change under the same name, so nothing may be cached.
              res.setHeader('cache-control', 'no-store');
              res.end(asset.bytes);
            } catch (err) {
              const status = (err as { status?: number }).status ?? 500;
              json(res, status, { error: err instanceof Error ? err.message : 'read failed' });
            }
          })();
          return;
        }
        if (method === 'POST') {
          void send(res, async () => {
            const bytes = await readBytes(req, MAX_UPLOAD);
            return { ok: true, ...(await writeAsset(ctx, scope, name, bytes)) };
          });
          return;
        }
        if (method === 'DELETE') {
          void send(res, () => deleteAsset(ctx, scope, name));
          return;
        }
        next();
      });
    },
  };
}
