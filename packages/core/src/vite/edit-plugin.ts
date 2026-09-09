import type { Plugin } from 'vite';
import type { EditOp } from '../editing/edit-ops.ts';
import { editElement, type OpsContext } from '../ops/index.ts';
import { json, readJson, send } from './http.ts';

type Body = { frameId?: string; line?: number; column?: number; ops?: EditOp[] };

/**
 * Writes an inspector edit back into the frame's source.
 *
 * Dev only. The work is `editElement`, which the MCP server calls too — one
 * implementation of "change this element", including what it refuses.
 */
export function editPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-design-frame:edit',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__edit', (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        void send(res, async () => {
          const body = (await readJson(req)) as Body;
          const { frameId, line, column, ops } = body;
          if (typeof line !== 'number' || typeof column !== 'number' || !Array.isArray(ops)) {
            return { ok: false, error: 'line, column and ops are required' };
          }
          const result = await editElement(ctx, String(frameId), line, column, ops);
          return { ok: true, changed: result.changed };
        });
      });
    },
  };
}
