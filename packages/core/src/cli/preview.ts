import { preview as vitePreview } from 'vite';
import { createViteConfig } from '../vite/config.ts';

export async function preview(
  opts: { port?: number; host?: string | boolean } = {},
): Promise<void> {
  const config = await createViteConfig({ userCwd: process.cwd() });
  const server = await vitePreview({
    ...config,
    preview: {
      port: opts.port ?? 4174,
      ...(opts.host !== undefined ? { host: opts.host } : {}),
    },
  });
  server.printUrls();
}
