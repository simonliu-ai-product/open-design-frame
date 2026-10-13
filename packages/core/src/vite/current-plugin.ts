import type { Plugin } from 'vite';
import { type OpsContext, readCurrentFrame, writeCurrentFrame } from '../ops/index.ts';
import { readJson, send } from './http.ts';

type CurrentBody = {
  frameId?: unknown;
  frameIndex?: unknown;
  frameName?: unknown;
  viewMode?: unknown;
  selectedLoc?: unknown;
  selectedLabel?: unknown;
};

/** Records which frame and element the designer is looking at. Dev only. */
export function currentPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-design-frame:current',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__current', (req, res, next) => {
        const method = req.method ?? 'GET';
        if (method === 'GET') {
          void send(res, async () => ({ current: await readCurrentFrame(ctx) }));
          return;
        }
        if (method === 'POST' || method === 'PUT') {
          void send(res, async () => {
            const body = (await readJson(req)) as CurrentBody;
            const loc =
              body.selectedLoc &&
              typeof body.selectedLoc === 'object' &&
              typeof (body.selectedLoc as { line?: unknown }).line === 'number' &&
              typeof (body.selectedLoc as { column?: unknown }).column === 'number'
                ? {
                    line: (body.selectedLoc as { line: number }).line,
                    column: (body.selectedLoc as { column: number }).column,
                  }
                : null;
            const viewMode =
              body.viewMode === 'single' || body.viewMode === 'split' || body.viewMode === 'grid'
                ? body.viewMode
                : 'single';
            return writeCurrentFrame(ctx, {
              frameId: typeof body.frameId === 'string' ? body.frameId : null,
              frameIndex: typeof body.frameIndex === 'number' ? body.frameIndex : 0,
              frameName: typeof body.frameName === 'string' ? body.frameName : null,
              viewMode,
              selectedLoc: loc,
              selectedLabel: typeof body.selectedLabel === 'string' ? body.selectedLabel : null,
            });
          });
          return;
        }
        next();
      });
    },
  };
}
