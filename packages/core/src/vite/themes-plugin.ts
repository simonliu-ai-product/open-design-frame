import type { Plugin } from 'vite';
import { mergeDesign } from '../app/lib/design.ts';
import { starterDesignDoc } from '../editing/design-doc.ts';
import { type OpsContext, readThemeDoc, writeThemeDoc } from '../ops/index.ts';
import { readJson, send } from './http.ts';

type Body = { markdown?: unknown; design?: unknown; name?: unknown };

/**
 * A theme's design document.
 *
 * Reading goes through the bundled module, not this route, so a static build
 * shows the same text. This is the writing half: an author asking for a
 * starting point, or an agent keeping the document in step with the tokens.
 */
export function themesPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-frame:themes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__themes', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const [id = '', action] = url.pathname.split('/').filter(Boolean);
        const method = req.method ?? 'GET';

        if (method === 'GET' && action === 'design') {
          void send(res, () => readThemeDoc(ctx, id));
          return;
        }
        if (method === 'PUT' && action === 'design') {
          void send(res, async () => {
            const body = (await readJson(req).catch(() => ({}))) as Body;
            const markdown =
              typeof body.markdown === 'string'
                ? body.markdown
                : starterDesignDoc(
                    typeof body.name === 'string' ? body.name : id,
                    mergeDesign(body.design as never),
                  );
            const written = await writeThemeDoc(ctx, id, markdown);
            // The document is bundled into a module the page already loaded.
            server.ws.send({ type: 'full-reload' });
            return written;
          });
          return;
        }
        next();
      });
    },
  };
}
