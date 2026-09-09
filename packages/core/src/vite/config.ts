import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';
import type { OpenFrameConfig } from '../config.ts';
import { makeContext } from '../ops/index.ts';
import { assetsPlugin } from './assets-plugin.ts';
import { commentsPlugin } from './comments-plugin.ts';
import { editPlugin } from './edit-plugin.ts';
import { foldersPlugin } from './folders-plugin.ts';
import { framesPlugin } from './frames-plugin.ts';
import { locTagsPlugin } from './loc-tags-plugin.ts';
import { mcpPlugin } from './mcp-plugin.ts';
import { openFramePlugin } from './open-frame-plugin.ts';
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
  throw new Error(`open-frame: no package.json above ${fromFile}`);
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

async function readUserConfig(userCwd: string): Promise<OpenFrameConfig> {
  for (const name of ['open-frame.config.ts', 'open-frame.config.js', 'open-frame.config.mjs']) {
    const file = path.join(userCwd, name);
    try {
      const mod = (await import(pathToFileURL(file).href)) as { default?: OpenFrameConfig };
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
  /** Mount the MCP endpoint at /mcp (requires `@open-frame/mcp`). */
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
      openFramePlugin({ userCwd, config }),
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
        // A frame imports `@open-frame/core`; from the viewer's root that name
        // resolves against core's own node_modules, which is where it already is.
        react: path.dirname(require.resolve('react/package.json')),
        'react-dom': path.dirname(require.resolve('react-dom/package.json')),
      },
    },
    server: {
      port: config.port ?? 5274,
      ...(config.allowedHosts !== undefined ? { allowedHosts: config.allowedHosts } : {}),
      fs: { allow: [APP_ROOT, userCwd, framesAbs, themesAbs, assetsAbs] },
    },
    build: { outDir: path.resolve(userCwd, 'dist'), emptyOutDir: true },
  };
}
