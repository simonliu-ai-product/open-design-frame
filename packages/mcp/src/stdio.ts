#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { makeContext, OpsError } from '@open-design-frame/core/ops';
import { registerTools } from './tools.ts';
import { findWorkspace, workspaceFromRoots } from './workspace.ts';

/**
 * `open-design-frame-mcp` — the same tools as `open-design-frame dev --mcp`,
 * over stdio, for clients that start their MCP servers themselves (Claude
 * Code, Antigravity, Gemini CLI, a host app). The workspace is the first of:
 * `--cwd` / `OPEN_DESIGN_FRAME_CWD`, the roots the client reports, the launch
 * directory or one of its parents. Until one is found every tool refuses, so
 * nothing is ever written into a folder that is not a workspace.
 */

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const { values } = parseArgs({ options: { cwd: { type: 'string' } }, strict: false });
const explicit = (values.cwd as string | undefined) ?? process.env.OPEN_DESIGN_FRAME_CWD;

// Tools close over this object, so settling the workspace later is a mutation.
const ctx = makeContext({ userCwd: process.cwd(), version });
let settled = false;

const server = new McpServer({ name: 'open-design-frame', version, title: 'open-design-frame' });

async function resolveWorkspace(): Promise<string | null> {
  if (explicit) {
    const dir = path.resolve(explicit);
    return existsSync(dir) ? dir : null;
  }
  if (server.server.getClientCapabilities()?.roots) {
    try {
      const { roots } = await server.server.listRoots();
      const found = workspaceFromRoots(roots.map((r) => r.uri));
      if (found) return found;
    } catch {
      // A client that advertises roots but fails the request falls through.
    }
  }
  return findWorkspace(process.cwd());
}

async function ensureWorkspace(): Promise<void> {
  if (settled) return;
  const dir = await resolveWorkspace();
  if (!dir) {
    throw new OpsError(
      412,
      'No open-design-frame workspace found. Open the folder that holds frames/ and ' +
        'open-design-frame.config.ts, or create one with `npx open-design-frame init my-design`.',
    );
  }
  Object.assign(ctx, makeContext({ userCwd: dir, version }));
  settled = true;
  console.error(`open-design-frame-mcp: workspace ${dir}`);
}

registerTools(server, ctx, ensureWorkspace);

// Re-resolve on the next call when the client's folders change.
server.server.setNotificationHandler('notifications/roots/list_changed', () => {
  if (!explicit) settled = false;
});

await server.connect(new StdioServerTransport());
