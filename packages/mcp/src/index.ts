import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  McpServer,
  originValidationResponse,
} from '@modelcontextprotocol/server';
import { makeContext, type OpsContext } from '@open-frame/core/ops';
import { registerTools } from './tools.ts';

export type OpenFrameMcpOptions = {
  /** The workspace root — the directory holding `frames/`. */
  userCwd: string;
  framesDir?: string;
  themesDir?: string;
  assetsDir?: string;
  version?: string;
  /**
   * Extra hostnames allowed in Host/Origin headers. Loopback is always allowed;
   * add to this only when the endpoint is deliberately exposed.
   */
  allowedHosts?: string[];
};

function contextFor(opts: OpenFrameMcpOptions): OpsContext {
  return makeContext({
    userCwd: opts.userCwd,
    ...(opts.framesDir !== undefined ? { framesDir: opts.framesDir } : {}),
    ...(opts.themesDir !== undefined ? { themesDir: opts.themesDir } : {}),
    ...(opts.assetsDir !== undefined ? { assetsDir: opts.assetsDir } : {}),
    version: opts.version ?? '0.0.0',
  });
}

/**
 * A fresh server per request.
 *
 * The tools only touch disk, so there is nothing worth carrying between calls
 * — which is the stateless shape that lets a client connect without a session
 * handshake.
 */
export function createOpenFrameMcpServer(opts: OpenFrameMcpOptions): McpServer {
  const server = new McpServer({
    name: 'open-frame',
    version: opts.version ?? '0.0.0',
    title: 'open-frame',
  });
  registerTools(server, contextFor(opts));
  return server;
}

export function createOpenFrameMcpHandler(opts: OpenFrameMcpOptions) {
  const allowedHostnames = [...localhostAllowedHostnames(), ...(opts.allowedHosts ?? [])];
  const allowedOrigins = [...localhostAllowedOrigins(), ...(opts.allowedHosts ?? [])];
  const handler = createMcpHandler(() => createOpenFrameMcpServer(opts));

  return {
    ...handler,
    /**
     * These tools write to the user's disk, so a page in the browser must not be
     * able to drive them. Rejecting unexpected Host and Origin headers is what
     * closes the DNS-rebinding path onto a loopback endpoint.
     */
    fetch: async (request: Request): Promise<Response> => {
      const hostRejection = hostHeaderValidationResponse(request, allowedHostnames);
      if (hostRejection) return hostRejection;
      const originRejection = originValidationResponse(request, allowedOrigins);
      if (originRejection) return originRejection;
      return handler.fetch(request);
    },
  };
}

/** Connect-style middleware, for mounting on the dev server. */
export function createOpenFrameMcpMiddleware(opts: OpenFrameMcpOptions) {
  return toNodeHandler(createOpenFrameMcpHandler(opts));
}
