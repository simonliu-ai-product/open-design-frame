import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';

type Middleware = (req: unknown, res: unknown, next: (err?: unknown) => void) => void;

/**
 * Finds a package's ESM entry by walking `node_modules` up from the workspace.
 *
 * Node's own resolver is not used: the package belongs to whoever opted into
 * the endpoint rather than to core, and under pnpm's strict layout core cannot
 * see a sibling it does not depend on.
 */
function resolveEsmEntry(userCwd: string, name: string): string | null {
  let dir = path.resolve(userCwd);
  for (;;) {
    const manifest = path.join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
        exports?: { '.'?: { import?: string } };
        module?: string;
        main?: string;
      };
      const entry = pkg.exports?.['.']?.import ?? pkg.module ?? pkg.main;
      return entry ? path.join(path.dirname(manifest), entry) : null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type McpPluginOptions = {
  userCwd: string;
  framesDir?: string;
  themesDir?: string;
  assetsDir?: string;
  version?: string;
  /** Path the MCP endpoint is served on. */
  endpoint?: string;
};

/**
 * Mounts `@open-design-frame/mcp` on the dev server so an agent and the browser act on
 * one workspace — a tool call lands on disk and the canvas hot-reloads.
 *
 * The package is imported dynamically and is not a dependency of core: the MCP
 * SDK is sizeable and only matters to people wiring up agents, so it stays
 * opt-in. A missing install is reported, never fatal.
 */
export function mcpPlugin(opts: McpPluginOptions): Plugin {
  const endpoint = opts.endpoint ?? '/mcp';
  return {
    name: 'open-design-frame:mcp',
    apply: 'serve',
    configureServer(server) {
      let mod: { createOpenDesignFrameMcpMiddleware: (o: unknown) => Middleware } | null = null;
      let middleware: Middleware | undefined;

      const load = async () => {
        if (mod) return mod;
        const specifier = '@open-design-frame/mcp';
        const entry = resolveEsmEntry(opts.userCwd, specifier);
        mod = (await import(entry ? pathToFileURL(entry).href : specifier)) as typeof mod;
        return mod;
      };

      server.middlewares.use(endpoint, (req, res, next) => {
        void (async () => {
          try {
            const loaded = await load();
            if (!loaded) return next();
            middleware ??= loaded.createOpenDesignFrameMcpMiddleware({
              userCwd: opts.userCwd,
              framesDir: opts.framesDir,
              themesDir: opts.themesDir,
              assetsDir: opts.assetsDir,
              version: opts.version,
            });
            middleware(req, res, next);
          } catch {
            res.statusCode = 501;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'MCP endpoint unavailable — add @open-design-frame/mcp to this workspace',
              }),
            );
          }
        })();
      });

      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port = typeof address === 'object' && address ? address.port : '';
        server.config.logger.info(`  ➜  MCP:     http://localhost:${port}${endpoint}`);
      });
    },
  };
}
