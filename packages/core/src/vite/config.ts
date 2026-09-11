import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';
import type { OpenDesignFrameConfig } from '../config.ts';
import { makeContext } from '../ops/index.ts';
import { assetsPlugin } from './assets-plugin.ts';
import { commentsPlugin } from './comments-plugin.ts';
import { editPlugin } from './edit-plugin.ts';
import { foldersPlugin } from './folders-plugin.ts';
import { framesPlugin } from './frames-plugin.ts';
import { locTagsPlugin } from './loc-tags-plugin.ts';
import { mcpPlugin } from './mcp-plugin.ts';
import { openDesignFramePlugin } from './open-design-frame-plugin.ts';
import { themesPlugin } from './themes-plugin.ts';

const require = createRequire(import.meta.url);

/**
 * The viewer ships as source, not as a build.
 *
 * It is compiled by the user's own Vite alongside their frames — which is what
 * lets a frame import React and get the same copy the viewer is using. Shipping
 * it built would mean two Reacts in one page, and hooks would fail on the
 * second one.
 */
function findPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`open-design-frame: no package.json above ${fromFile}`);
}

const PKG_ROOT = findPackageRoot(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(PKG_ROOT, 'src', 'app');

function readCoreVersion(): string {
  try {
    const raw = readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const CORE_VERSION = readCoreVersion();

async function readUserConfig(userCwd: string): Promise<OpenDesignFrameConfig> {
  for (const name of [
    'open-design-frame.config.ts',
    'open-design-frame.config.js',
    'open-design-frame.config.mjs',
  ]) {
    const file = path.join(userCwd, name);
    try {
      const mod = (await import(pathToFileURL(file).href)) as { default?: OpenDesignFrameConfig };
      return mod.default ?? {};
    } catch {
      // Missing is the common case; a real syntax error surfaces when Vite loads
      // the project anyway, with a better message than anything we could add.
    }
  }
  return {};
}

export type CreateViteConfigOptions = {
  userCwd: string;
  /** Mount the MCP endpoint at /mcp (requires `@open-design-frame/mcp`). */
  mcp?: boolean;
};

export async function createViteConfig(opts: CreateViteConfigOptions): Promise<InlineConfig> {
  const { userCwd } = opts;
  const config = await readUserConfig(userCwd);
  const framesAbs = path.resolve(userCwd, config.framesDir ?? 'frames');
  const themesAbs = path.resolve(userCwd, config.themesDir ?? 'themes');
  const assetsAbs = path.resolve(userCwd, config.assetsDir ?? 'assets');
  /* One context for every route: the same object the MCP server is given. */
  const ctx = makeContext({
    userCwd,
    ...(config.framesDir !== undefined ? { framesDir: config.framesDir } : {}),
    ...(config.themesDir !== undefined ? { themesDir: config.themesDir } : {}),
    ...(config.assetsDir !== undefined ? { assetsDir: config.assetsDir } : {}),
  });

  return {
    root: APP_ROOT,
    base: config.base ?? '/',
    configFile: false,
    plugins: [
      locTagsPlugin({ framesRoot: framesAbs }),
      react(),
      openDesignFramePlugin({ userCwd, config }),
      editPlugin(ctx),
      assetsPlugin(ctx),
      commentsPlugin(ctx),
      foldersPlugin(ctx),
      framesPlugin(ctx),
      themesPlugin(ctx),
      ...(opts.mcp
        ? [
            mcpPlugin({
              userCwd,
              ...(config.framesDir !== undefined ? { framesDir: config.framesDir } : {}),
              ...(config.themesDir !== undefined ? { themesDir: config.themesDir } : {}),
              ...(config.assetsDir !== undefined ? { assetsDir: config.assetsDir } : {}),
              version: CORE_VERSION,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        // A frame imports `@open-design-frame/core`; from the viewer's root that name
        // resolves against core's own node_modules, which is where it already is.
        react: path.dirname(require.resolve('react/package.json')),
        'react-dom': path.dirname(require.resolve('react-dom/package.json')),
      },
    },
    /*
     * The viewer's own imports have to be pre-bundled by name.
     *
     * Vite finds what to optimise by crawling source from the root, and it
     * never crawls inside `node_modules` — everything there is assumed to be a
     * dependency already. In this repo that is invisible, because the root is
     * `packages/core/src/app` and the crawl reaches it. Installed, the same
     * files sit under `node_modules/.pnpm/.../core/src/app`, the crawl skips
     * them, and `react-router-dom` is served raw: it reaches for `cookie`,
     * which is CommonJS, and the page dies on a missing named export before
     * React mounts. Naming the entry and the deps makes the two cases the same.
     */
    optimizeDeps: {
      entries: [path.join(APP_ROOT, 'main.tsx')],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'fflate',
        'html-to-image',
        'marked',
      ],
    },
    server: {
      port: config.port ?? 5274,
      ...(config.allowedHosts !== undefined ? { allowedHosts: config.allowedHosts } : {}),
      fs: { allow: [APP_ROOT, userCwd, framesAbs, themesAbs, assetsAbs] },
    },
    build: { outDir: path.resolve(userCwd, 'dist'), emptyOutDir: true },
  };
}
