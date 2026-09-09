import { build as viteBuild } from 'vite';
import { createViteConfig } from '../vite/config.ts';

export async function build(opts: { outDir?: string } = {}): Promise<void> {
  const config = await createViteConfig({ userCwd: process.cwd() });
  await viteBuild({
    ...config,
    ...(opts.outDir ? { build: { ...config.build, outDir: opts.outDir } } : {}),
  });
}
