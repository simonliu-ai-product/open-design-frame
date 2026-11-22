import fs from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { checkItemResult, framesToCheck } from '../agent/check-after-turn.ts';
import { detectPackageManager } from '../agent/install.ts';
import type { AgentProvider } from '../agent/provider.ts';
import { createProviders } from '../agent/providers/index.ts';
import { createAgentRunner, type TurnEnd, type TurnSettings } from '../agent/runner.ts';
import { agentStatus, installSdk } from '../agent/status.ts';
import { createSessionStore, newId, type SessionStore } from '../agent/store.ts';
import {
  type AgentStreamEvent,
  type AgentTurnContext,
  isAgentEffort,
  isAgentProviderId,
  type RespondPayload,
} from '../agent/types.ts';
import { checkFrames, FRAME_ID_RE, listFrames, type OpsContext } from '../ops/index.ts';
import { json, readJson } from './http.ts';
import { isLoopbackRequest, validateMutationRequest } from './request-guard.ts';

// GET    /__agent/status                      → AgentStatus
// POST   /__agent/install                     { provider } → { ok }
// GET    /__agent/sessions                    → { sessions: AgentSessionSummary[] }
// POST   /__agent/sessions                    { provider, frameId? } → AgentSession
// GET    /__agent/sessions/:id                → AgentSession
// DELETE /__agent/sessions/:id                → { ok }
// POST   /__agent/sessions/:id/messages       { text, context?, model?, effort?, edit? } → { ok }
// POST   /__agent/sessions/:id/stop           → { ok }
// POST   /__agent/sessions/:id/respond        { itemId, answers? | cancel?, context?, model?, effort? } → { ok }
// GET    /__agent/events                      → server-sent turn progress

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

const count = (value: unknown, min: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.floor(value))
    : undefined;

export function parseContext(raw: unknown): AgentTurnContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const ctx: AgentTurnContext = {};
  if (typeof r.frameId === 'string' && FRAME_ID_RE.test(r.frameId)) ctx.frameId = r.frameId;
  const title = clip(r.frameTitle, 120);
  if (title) ctx.frameTitle = title;
  const pending = count(r.pendingComments, 0);
  if (pending !== undefined) ctx.pendingComments = pending;
  const art = r.artboard as Record<string, unknown> | null | undefined;
  if (art && typeof art === 'object') {
    const index = count(art.index, 0);
    const total = count(art.total, 1);
    if (index !== undefined && total !== undefined && index < total) {
      ctx.artboard = {
        index,
        total,
        name: clip(art.name, 120) ?? `Frame ${index + 1}`,
        width: count(art.width, 0) ?? 0,
        height: count(art.height, 0) ?? 0,
      };
    }
  }
  const sel = r.selection as Record<string, unknown> | null | undefined;
  if (sel && typeof sel === 'object' && typeof sel.line === 'number') {
    const line = count(sel.line, 1);
    const column = count(sel.column, 0);
    if (line !== undefined && column !== undefined) {
      ctx.selection = {
        line,
        column,
        label: clip(sel.label, 120) ?? '',
        tagName: clip(sel.tagName, 32) || 'element',
        text: clip(sel.text, 120) ?? '',
      };
    }
  }
  return ctx;
}

const MODEL_RE = /^[\w.:[\]-]{1,80}$/;

export function parseModel(raw: unknown): string | null {
  return typeof raw === 'string' && MODEL_RE.test(raw) ? raw : null;
}

export function parseRespond(raw: unknown): RespondPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.cancel === true) return { cancel: true };
  if (r.answers && typeof r.answers === 'object') {
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.answers as Record<string, unknown>)) {
      if (typeof v === 'string') answers[k] = v;
    }
    return { answers };
  }
  return null;
}

export function parseTurnSettings(raw: Record<string, unknown>): TurnSettings {
  const settings: TurnSettings = {};
  const context = parseContext(raw.context);
  if (context) settings.context = context;
  if ('model' in raw) settings.model = parseModel(raw.model);
  if ('effort' in raw) settings.effort = isAgentEffort(raw.effort) ? raw.effort : null;
  return settings;
}

const AGENT_BODY_LIMIT = 1024 * 1024;

export function agentSessionsFile(userCwd: string): string {
  return path.join(userCwd, 'node_modules', '.open-design-frame', 'agent-sessions.json');
}

const devOrigin = (server: ViteDevServer): string | undefined =>
  server.resolvedUrls?.local?.[0]?.replace(/\/$/, '');

// An agent whose sandbox cannot start a browser cannot draw a frame; the dev
// server is not sandboxed, so it checks the files the turn wrote for it and
// the result lands in the transcript. Drawing reuses this server.
async function checkAfterTurn(
  server: ViteDevServer,
  ctx: OpsContext,
  store: SessionStore,
  providers: Record<string, AgentProvider>,
  turn: TurnEnd,
): Promise<void> {
  const session = store.get(turn.sessionId);
  if (!session) return;
  // Another turn still writing would be checked half-written.
  if (store.list().some((s) => s.status === 'running')) return;
  const listed = await listFrames(ctx).catch(() => []);
  const entries = await Promise.all(
    listed.map(async (f) => ({
      id: f.id,
      mtimeMs: (await fs.stat(path.join(ctx.userCwd, f.file)).catch(() => null))?.mtimeMs ?? 0,
    })),
  );
  const frameIds = framesToCheck({
    session,
    userItemId: turn.userItemId,
    canOpenBrowser: providers[session.provider]?.canOpenBrowser ?? true,
    entries,
  });
  if (frameIds.length === 0) return;

  const { hasPlaywright } = await import('../render/session.ts');
  const rendered = hasPlaywright(ctx.userCwd);
  const item = store.appendItem(session.id, {
    kind: 'check',
    id: newId('c'),
    ts: new Date().toISOString(),
    frameIds,
    status: 'running',
    rendered,
    findings: [],
    total: 0,
    error: null,
  });
  const origin = devOrigin(server);
  try {
    const result = await checkFrames(ctx, frameIds, {
      render: rendered,
      ...(origin ? { origin } : {}),
    });
    if (!store.get(session.id)) return;
    store.updateItem(session.id, item.id, 'check', {
      status: 'done',
      ...checkItemResult(result.reports),
    });
  } catch (err) {
    if (!store.get(session.id)) return;
    store.updateItem(session.id, item.id, 'check', {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** The in-app agent panel's server half. Dev only. */
export function agentPlugin(ctx: OpsContext): Plugin {
  return {
    name: 'open-design-frame:agent',
    apply: 'serve',
    configureServer(server) {
      const providers = createProviders();
      const store = createSessionStore({ file: agentSessionsFile(ctx.userCwd) });
      // Agent output goes over its own stream rather than the HMR socket, which
      // every network client can subscribe to when the server runs with --host.
      const streams = new Set<ServerResponse>();
      const broadcast = (event: AgentStreamEvent) => {
        const frame = `data: ${JSON.stringify(event)}\n\n`;
        for (const stream of streams) stream.write(frame);
      };
      const heartbeat = setInterval(() => {
        for (const stream of streams) stream.write(': ping\n\n');
      }, 25_000);
      heartbeat.unref();

      const runner = createAgentRunner({
        userCwd: ctx.userCwd,
        writableRoots: [ctx.framesRoot, ctx.themesRoot, ctx.assetsRoot],
        promptOptions: () => ({
          framesDir: path.relative(ctx.userCwd, ctx.framesRoot) || 'frames',
          themesDir: path.relative(ctx.userCwd, ctx.themesRoot) || 'themes',
          assetsDir: path.relative(ctx.userCwd, ctx.assetsRoot) || 'assets',
        }),
        store,
        providers,
        onTurnEnd: (turn) => checkAfterTurn(server, ctx, store, providers, turn),
      });

      store.subscribe(broadcast);
      server.httpServer?.on('close', () => {
        clearInterval(heartbeat);
        for (const stream of streams) stream.end();
        runner.stopAll();
        void store.flush();
      });

      const installsInFlight = new Map<string, Promise<void>>();

      server.middlewares.use('/__agent', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = req.method ?? 'GET';
        const segments = url.pathname.split('/').filter(Boolean);
        // The agent runs commands in the workspace, so only this machine may
        // drive it, even when the dev server listens on the network.
        const enabled = isLoopbackRequest(req);
        const body = async () => (await readJson(req, AGENT_BODY_LIMIT)) as Record<string, unknown>;
        const guard = (requireJsonBody: boolean) => {
          const result = validateMutationRequest(req, { requireJsonBody });
          if (!result.ok) json(res, result.status, { error: result.error });
          return result.ok;
        };

        try {
          if (method === 'GET' && url.pathname === '/status') {
            res.setHeader('cache-control', 'no-store');
            if (!enabled) {
              return json(res, 200, { enabled: false, packageManager: '', providers: [] });
            }
            const pm = await detectPackageManager(ctx.userCwd);
            return json(res, 200, await agentStatus(ctx.userCwd, providers, pm));
          }

          if (!enabled) return json(res, 404, { error: 'agent panel disabled' });

          if (method === 'GET' && url.pathname === '/events') {
            res.writeHead(200, {
              'content-type': 'text/event-stream',
              'cache-control': 'no-store',
              connection: 'keep-alive',
            });
            res.write(': connected\n\n');
            streams.add(res);
            const drop = () => streams.delete(res);
            res.on('close', drop);
            res.on('error', drop);
            return;
          }

          if (method === 'POST' && url.pathname === '/install') {
            if (!guard(true)) return;
            const { provider: id } = await body();
            if (!isAgentProviderId(id)) return json(res, 400, { error: 'invalid provider' });
            const pm = await detectPackageManager(ctx.userCwd);
            const pkg = providers[id].sdkPackage;
            let install = installsInFlight.get(pkg);
            if (!install) {
              install = installSdk(pm, pkg, ctx.userCwd).finally(() =>
                installsInFlight.delete(pkg),
              );
              installsInFlight.set(pkg, install);
            }
            await install;
            return json(res, 200, { ok: true });
          }

          if (method === 'GET' && url.pathname === '/sessions') {
            res.setHeader('cache-control', 'no-store');
            return json(res, 200, { sessions: store.list() });
          }

          if (method === 'POST' && url.pathname === '/sessions') {
            if (!guard(true)) return;
            const { provider, frameId } = await body();
            if (!isAgentProviderId(provider)) return json(res, 400, { error: 'invalid provider' });
            const frame = typeof frameId === 'string' && FRAME_ID_RE.test(frameId) ? frameId : null;
            return json(res, 200, store.create(provider, frame));
          }

          if (segments[0] === 'sessions' && segments[1]) {
            const id = segments[1];
            const action = segments[2];
            const session = store.get(id);
            if (!session) return json(res, 404, { error: 'session not found' });

            if (method === 'GET' && !action) {
              res.setHeader('cache-control', 'no-store');
              return json(res, 200, session);
            }

            if (method === 'DELETE' && !action) {
              if (!guard(false)) return;
              runner.stop(id);
              store.remove(id);
              return json(res, 200, { ok: true });
            }

            if (method === 'POST' && action === 'messages') {
              if (!guard(true)) return;
              const raw = await body();
              if (typeof raw.text !== 'string' || !raw.text.trim()) {
                return json(res, 400, { error: 'missing text' });
              }
              if (runner.isRunning(id)) {
                return json(res, 409, { error: 'session is already running' });
              }
              if (
                raw.edit !== undefined &&
                !session.items.some((i) => i.id === raw.edit && i.kind === 'user')
              ) {
                return json(res, 400, { error: 'unknown message' });
              }
              const settings = parseTurnSettings(raw);
              await runner.send(id, {
                text: raw.text,
                ...settings,
                ...(typeof raw.edit === 'string' ? { edit: raw.edit } : {}),
              });
              return json(res, 202, { ok: true });
            }

            if (method === 'POST' && action === 'stop') {
              if (!guard(false)) return;
              return json(res, 200, { ok: runner.stop(id) });
            }

            if (method === 'POST' && action === 'respond') {
              if (!guard(true)) return;
              const raw = await body();
              const payload = parseRespond(raw);
              if (typeof raw.itemId !== 'string' || !payload) {
                return json(res, 400, { error: 'invalid response' });
              }
              const ok = runner.respond(id, raw.itemId, payload, parseTurnSettings(raw));
              return json(res, ok ? 200 : 409, ok ? { ok } : { error: 'nothing pending' });
            }
          }

          next();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message === 'body too large') return json(res, 413, { error: message });
          if (message === 'body is not JSON') return json(res, 400, { error: message });
          json(res, 500, { error: message });
        }
      });
    },
  };
}
