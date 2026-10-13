import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createFromTemplate, makeContext } from '../ops/index.ts';
import { syncSkills } from './sync.ts';

export type InitWorkspaceOptions = {
  dir?: string;
  template?: string;
  name?: string;
  force?: boolean;
};

export async function initWorkspace(opts: InitWorkspaceOptions = {}): Promise<{
  dir: string;
  frameFile: string;
  skills: string[];
}> {
  const target = resolve(process.cwd(), opts.dir ?? '.');
  await mkdir(target, { recursive: true });

  if (!opts.force && existsSync(target)) {
    const entries = await readdir(target);
    if (entries.some((e) => !e.startsWith('.'))) {
      throw new Error(`Target directory ${target} is not empty. Pass --force to overwrite.`);
    }
  }

  const pkgName = opts.name ?? (basename(target) || 'my-design-frames');
  const pkgJson = {
    name: pkgName,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'open-design-frame dev --mcp',
      build: 'open-design-frame build',
      preview: 'open-design-frame preview',
      check: 'open-design-frame check',
    },
    dependencies: {
      '@open-design-frame/core': '^0.1.1',
      '@open-design-frame/mcp': '^0.1.0',
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      '@types/react': '^19.2.14',
      '@types/react-dom': '^19.2.3',
      typescript: '^5.9.3',
    },
  };

  await writeFile(join(target, 'package.json'), `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8');

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ['frames', 'themes'],
  };
  await writeFile(join(target, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');

  const mcpJson = {
    mcpServers: {
      'open-design-frame': {
        type: 'http',
        url: 'http://localhost:5173/mcp',
      },
    },
  };
  await writeFile(join(target, '.mcp.json'), `${JSON.stringify(mcpJson, null, 2)}\n`, 'utf8');

  const agentsMd = `# ${pkgName} — open-design-frame Workspace

Frames live under \`frames/<id>/index.tsx\` and themes under \`themes/<id>/DESIGN.md\`.

## Useful Commands
- \`pnpm dev\` — start canvas viewer with hot reload and MCP server (\`/mcp\`)
- \`npx open-design-frame templates\` — list starter frame templates
- \`npx open-design-frame new <id> --template <name>\` — create a frame from a template
- \`npx open-design-frame check\` — verify syntax, prototype links, and assets
- \`npx open-design-frame diff\` — inspect changes mapped to canvas elements
`;
  await writeFile(join(target, 'AGENTS.md'), agentsMd, 'utf8');
  await writeFile(join(target, 'CLAUDE.md'), agentsMd, 'utf8');
  await writeFile(join(target, '.gitignore'), 'node_modules\ndist\n.DS_Store\n', 'utf8');

  await mkdir(join(target, 'themes'), { recursive: true });
  const ctx = makeContext({ userCwd: target });
  const created = await createFromTemplate(ctx, {
    template: opts.template ?? 'landing-page',
    frameId: '01-welcome',
    title: 'Welcome Frame',
  });

  const skills = await syncSkills(target);
  return { dir: target, frameFile: created.file, skills };
}
