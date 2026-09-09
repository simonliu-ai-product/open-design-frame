import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { Plugin } from 'vite';
import type { OpenDesignFrameConfig } from '../config.ts';
import { listThemes, MANIFEST_NAME, makeContext, readFolders, themeDocPath } from '../ops/index.ts';

const FRAMES_VMOD = 'virtual:open-design-frame/frames';
const CONFIG_VMOD = 'virtual:open-design-frame/config';
const FOLDERS_VMOD = 'virtual:open-design-frame/folders';
const THEMES_VMOD = 'virtual:open-design-frame/themes';
const THEME_DOCS_VMOD = 'virtual:open-design-frame/theme-docs';
const FRAME_PREFIX = 'virtual:open-design-frame/frame/';
const THEME_PREFIX = 'virtual:open-design-frame/theme/';

/**
 * A frame id reaches the URL bar, the filesystem, and the export filename.
 * Anything outside this set would have to be escaped differently in each of
 * them, so a folder that cannot be one is skipped with a warning rather than
 * listed as a frame that then fails every action.
 */
const FRAME_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type OpenDesignFramePluginOptions = {
  userCwd: string;
  config: OpenDesignFrameConfig;
};

type Entry = { id: string; file: string };

async function discover(root: string): Promise<{ entries: Entry[]; ignored: string[] }> {
  const matches = await fg('*/index.{tsx,jsx,ts,js}', { cwd: root, onlyFiles: true });
  const seen = new Map<string, string>();
  for (const rel of matches.sort()) {
    const id = rel.split('/')[0] ?? '';
    if (id !== '' && !seen.has(id)) seen.set(id, path.join(root, rel));
  }
  const all = [...seen.entries()].map(([id, file]) => ({ id, file }));
  return {
    entries: all.filter((e) => FRAME_ID_RE.test(e.id)).sort((a, b) => a.id.localeCompare(b.id)),
    ignored: all.filter((e) => !FRAME_ID_RE.test(e.id)).map((e) => e.id),
  };
}

export function openDesignFramePlugin(opts: OpenDesignFramePluginOptions): Plugin {
  const { userCwd, config } = opts;
  const framesRoot = path.resolve(userCwd, config.framesDir ?? 'frames');
  const themesRoot = path.resolve(userCwd, config.themesDir ?? 'themes');
  let files = new Map<string, string>();
  let themeFiles = new Map<string, string>();

  return {
    name: 'open-design-frame',
    resolveId(id) {
      if (id === FRAMES_VMOD || id === CONFIG_VMOD || id === FOLDERS_VMOD) return `\0${id}`;
      if (id === THEMES_VMOD || id === THEME_DOCS_VMOD) return `\0${id}`;
      if (id.startsWith(THEME_PREFIX)) return themeFiles.get(id.slice(THEME_PREFIX.length)) ?? null;
      /*
       * The generated list imports each frame by a name of ours, and this turns
       * that name into the real file. Writing the path into the import instead
       * would mean emitting a `/@fs` address in dev and a plain one in a build
       * — a branch that has to know the mode before the mode is settled, and
       * the generated module is loaded early enough that it sometimes isn't.
       */
      if (id.startsWith(FRAME_PREFIX)) return files.get(id.slice(FRAME_PREFIX.length)) ?? null;
      return null;
    },
    async load(id) {
      if (id === `\0${CONFIG_VMOD}`) return `export default ${JSON.stringify(config)};`;
      /*
       * A static build has no dev server to ask, so the manifest is baked in at
       * build time. In dev the viewer reads it live from `/__folders` instead —
       * a snapshot would go stale the moment a folder is renamed.
       */
      if (id === `\0${FOLDERS_VMOD}`) {
        const ctx = makeContext({ userCwd, framesDir: config.framesDir });
        return `export default ${JSON.stringify(await readFolders(ctx))};`;
      }
      if (id === `\0${THEMES_VMOD}` || id === `\0${THEME_DOCS_VMOD}`) {
        const ctx = makeContext({
          userCwd,
          ...(config.framesDir !== undefined ? { framesDir: config.framesDir } : {}),
          ...(config.themesDir !== undefined ? { themesDir: config.themesDir } : {}),
        });
        const themes = await listThemes(ctx);

        /*
         * The documents are read here rather than fetched: a static build has
         * no server to ask, and a theme's prose belongs with its tokens in the
         * same bundle it is read from.
         */
        if (id === `\0${THEME_DOCS_VMOD}`) {
          const docs: Record<string, string> = {};
          for (const theme of themes) {
            if (theme.doc === null) continue;
            const file = await themeDocPath(ctx, theme.id);
            const text = await fs.readFile(file, 'utf8').catch(() => null);
            if (text !== null) docs[theme.id] = text;
          }
          return `export default ${JSON.stringify(docs)};`;
        }

        themeFiles = new Map(themes.map((e) => [e.id, path.resolve(userCwd, e.file)]));
        const themeCases = themes
          .map(
            (e) =>
              `    case ${JSON.stringify(e.id)}: return import(${JSON.stringify(
                `${THEME_PREFIX}${e.id}`,
              )});`,
          )
          .join('\n');
        return `// ${THEMES_VMOD} — generated
export const themeIds = ${JSON.stringify(themes.map((e) => e.id))};

export async function loadTheme(id) {
  switch (id) {
${themeCases}
    default: throw new Error('Theme not found: ' + id);
  }
}
`;
      }
      if (id !== `\0${FRAMES_VMOD}`) return null;

      const { entries, ignored } = await discover(framesRoot);
      files = new Map(entries.map((e) => [e.id, e.file]));
      for (const bad of ignored) {
        this.warn(`ignoring frames/${bad} — a frame id must be lowercase words joined by hyphens`);
      }
      const cases = entries
        .map(
          (e) =>
            `    case ${JSON.stringify(e.id)}: return import(${JSON.stringify(
              `${FRAME_PREFIX}${e.id}`,
            )});`,
        )
        .join('\n');
      return `// ${FRAMES_VMOD} — generated
export const frameIds = ${JSON.stringify(entries.map((e) => e.id))};

export async function loadFrame(id) {
  switch (id) {
${cases}
    default: throw new Error('Frame not found: ' + id);
  }
}
`;
    },
    configureServer(server) {
      /*
       * The Vite root is the viewer's own folder, so the watcher does not reach
       * the project's frames on its own — a new frame would appear only after a
       * manual restart.
       */
      server.watcher.add(framesRoot);
      server.watcher.add(themesRoot);

      // A new folder is a new frame, and the module that lists them is generated
      // — so the list has to be thrown away, not just the file that changed.
      const invalidate = (file: string) => {
        if (!file.startsWith(framesRoot) && !file.startsWith(themesRoot)) return;
        // The manifest is fetched live in dev; writing it must not reload the page.
        if (path.basename(file) === MANIFEST_NAME) return;
        for (const vmod of [FRAMES_VMOD, THEMES_VMOD, THEME_DOCS_VMOD]) {
          const mod = server.moduleGraph.getModuleById(`\0${vmod}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
      // A design document is content, not a module Vite already tracks.
      server.watcher.on('change', (file) => {
        if (file.endsWith('.md')) invalidate(file);
      });
    },
  };
}
