import { createServer } from 'vite';
import { createViteConfig } from '../vite/config.ts';

export async function dev(
  opts: { port?: number; host?: string | boolean; mcp?: boolean } = {},
): Promise<void> {
  const config = await createViteConfig({ userCwd: process.cwd(), mcp: opts.mcp === true });
  const server = await createServer({
    ...config,
    server: {
      ...config.server,
      ...(opts.port !== undefined ? { port: opts.port } : {}),
      ...(opts.host !== undefined ? { host: opts.host } : {}),
    },
  });
  await server.listen();
  server.printUrls();
}
