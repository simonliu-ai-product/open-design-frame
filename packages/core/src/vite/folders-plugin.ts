import type { Plugin } from 'vite';
import {
  assignFrameToFolder,
  createFolder,
  deleteFolder,
  type OpsContext,
  readFolders,
  renameFolder,
} from '../ops/index.ts';
import { readJson, send } from './http.ts';

/**
 * The folders the home page groups frames into.
 *
 * A folder is a label, not a directory: moving a frame between folders must not
 * move its file, because the file's path is its id.
 */
export function foldersPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-frame:folders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__folders', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = req.method ?? 'GET';
        const id = url.pathname.split('/').filter(Boolean)[0] ?? '';

        if (method === 'GET') {
          void send(res, () => readFolders(ctx));
          return;
        }
        if (method === 'POST' && id === '') {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as { name?: unknown };
            return createFolder(ctx, body.name);
          });
          return;
        }
        if (method === 'PUT' && id === 'assign') {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as {
              frameId?: unknown;
              folderId?: unknown;
            };
            const folderId = body.folderId === null ? null : String(body.folderId);
            return assignFrameToFolder(ctx, String(body.frameId), folderId);
          });
          return;
        }
        if (method === 'PATCH' && id !== '') {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as { name?: unknown };
            return renameFolder(ctx, id, body.name);
          });
          return;
        }
        if (method === 'DELETE' && id !== '') {
          void send(res, () => deleteFolder(ctx, id));
          return;
        }
        next();
      });
    },
  };
}
