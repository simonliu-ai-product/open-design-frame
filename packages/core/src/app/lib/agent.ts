import { useEffect, useSyncExternalStore } from 'react';
import {
  type AgentEffort,
  type AgentItem,
  type AgentModelOption,
  type AgentProviderId,
  type AgentSession,
  type AgentSessionSummary,
  type AgentStatus,
  type AgentStreamEvent,
  type AgentTurnContext,
  isAgentEffort,
  isAgentProviderId,
  type RespondPayload,
} from '../../agent/types.ts';
import { hostCan } from './host.ts';

type ModelChoice = { model: string; effort: AgentEffort | null };

type State = {
  status: AgentStatus | null;
  statusError: boolean;
  sessions: AgentSessionSummary[];
  sessionsLoaded: boolean;
  full: Record<string, AgentSession>;
  activeId: string | null;
  provider: AgentProviderId;
  modelChoices: Partial<Record<AgentProviderId, ModelChoice>>;
  installing: AgentProviderId | null;
  connectErrors: Partial<Record<AgentProviderId, string>>;
};

const ACTIVE_KEY = 'open-design-frame.agent-session';
const PROVIDER_KEY = 'open-design-frame.agent-provider';
const MODEL_KEY = 'open-design-frame.agent-model';
export const AGENT_DOCK_KEY = 'open-design-frame.agent-dock';

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function readModelChoices(): Partial<Record<AgentProviderId, ModelChoice>> {
  const choices: Partial<Record<AgentProviderId, ModelChoice>> = {};
  try {
    const raw = JSON.parse(readStorage(MODEL_KEY) ?? '{}') as Record<string, unknown>;
    for (const [provider, value] of Object.entries(raw)) {
      if (!isAgentProviderId(provider) || !value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      if (typeof v.model !== 'string') continue;
      choices[provider] = { model: v.model, effort: isAgentEffort(v.effort) ? v.effort : null };
    }
  } catch {}
  return choices;
}

/**
 * The panel exists only in dev, where a server can run the agent, and only
 * when no host brings an agent of its own.
 */
export const agentAvailable =
  import.meta.env.DEV && typeof window !== 'undefined' && !hostCan('agent');

let state: State = {
  status: null,
  statusError: false,
  sessions: [],
  sessionsLoaded: false,
  full: {},
  activeId: readStorage(ACTIVE_KEY),
  provider: (() => {
    const stored = readStorage(PROVIDER_KEY);
    return isAgentProviderId(stored) ? stored : 'codex';
  })(),
  modelChoices: readModelChoices(),
  installing: null,
  connectErrors: {},
};

const listeners = new Set<() => void>();

function setState(patch: Partial<State> | ((prev: State) => Partial<State>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): State => state;

export function useAgentState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let stream: EventSource | null = null;
let streamOpened = false;

function syncStream(enabled: boolean) {
  if (!enabled) {
    stream?.close();
    stream = null;
    return;
  }
  if (stream) return;
  stream = new EventSource('/__agent/events');
  stream.onmessage = (message) => applyEvent(JSON.parse(message.data) as AgentStreamEvent);
  stream.onopen = () => {
    // Anything streamed while disconnected is gone, so reload what is on screen.
    if (!streamOpened) {
      streamOpened = true;
      return;
    }
    void refreshStatus();
    if (state.sessionsLoaded) void loadSessions();
    for (const id of Object.keys(state.full)) void loadSession(id);
  };
}

function upsertSummary(list: AgentSessionSummary[], summary: AgentSessionSummary) {
  const rest = list.filter((s) => s.id !== summary.id);
  return [summary, ...rest].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

function applyEvent(event: AgentStreamEvent) {
  switch (event.type) {
    case 'session':
      setState((prev) => {
        const current = prev.full[event.session.id];
        return {
          sessions: upsertSummary(prev.sessions, event.session),
          full: current
            ? { ...prev.full, [event.session.id]: { ...current, ...event.session } }
            : prev.full,
        };
      });
      return;
    case 'session-removed':
      setState((prev) => {
        const { [event.sessionId]: _gone, ...full } = prev.full;
        return {
          sessions: prev.sessions.filter((s) => s.id !== event.sessionId),
          full,
          activeId: prev.activeId === event.sessionId ? null : prev.activeId,
        };
      });
      return;
    case 'item':
      setState((prev) => {
        const current = prev.full[event.sessionId];
        if (!current) return {};
        const index = current.items.findIndex((i) => i.id === event.item.id);
        const items =
          index === -1
            ? [...current.items, event.item]
            : current.items.map((i, n) => (n === index ? event.item : i));
        return { full: { ...prev.full, [event.sessionId]: { ...current, items } } };
      });
      return;
    case 'truncate':
      setState((prev) => {
        const current = prev.full[event.sessionId];
        const index = current?.items.findIndex((i) => i.id === event.itemId) ?? -1;
        if (!current || index === -1) return {};
        const items = current.items.slice(0, index);
        return { full: { ...prev.full, [event.sessionId]: { ...current, items } } };
      });
      return;
    case 'delta':
      setState((prev) => {
        const current = prev.full[event.sessionId];
        if (!current) return {};
        const items = current.items.map((i): AgentItem => {
          if (i.id !== event.itemId || i.kind !== 'assistant') return i;
          return { ...i, text: i.text + event.text };
        });
        return { full: { ...prev.full, [event.sessionId]: { ...current, items } } };
      });
      return;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${init?.method ?? 'GET'} ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

function post(body?: unknown): RequestInit {
  return body === undefined
    ? { method: 'POST' }
    : {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      };
}

export async function refreshStatus(): Promise<void> {
  if (!agentAvailable) return;
  try {
    const status = await request<AgentStatus>('/__agent/status');
    setState({ status, statusError: false });
    syncStream(status.enabled);
  } catch {
    setState({ statusError: true });
  }
}

async function loadSessions(): Promise<void> {
  if (!agentAvailable) return;
  try {
    const { sessions } = await request<{ sessions: AgentSessionSummary[] }>('/__agent/sessions');
    setState((prev) => ({
      sessions,
      sessionsLoaded: true,
      activeId:
        prev.activeId && !sessions.some((s) => s.id === prev.activeId) ? null : prev.activeId,
    }));
  } catch {
    setState({ sessionsLoaded: true });
  }
}

async function loadSession(id: string): Promise<AgentSession | null> {
  if (!agentAvailable) return null;
  try {
    const session = await request<AgentSession>(`/__agent/sessions/${encodeURIComponent(id)}`);
    setState((prev) => ({ full: { ...prev.full, [id]: session } }));
    return session;
  } catch {
    setState((prev) => {
      const { [id]: _gone, ...full } = prev.full;
      return { full, activeId: prev.activeId === id ? null : prev.activeId };
    });
    return null;
  }
}

export async function createSession(
  provider: AgentProviderId,
  frameId: string | null,
): Promise<AgentSession> {
  const session = await request<AgentSession>('/__agent/sessions', post({ provider, frameId }));
  setState((prev) => ({
    full: { ...prev.full, [session.id]: session },
    sessions: upsertSummary(prev.sessions, session),
  }));
  setActiveSession(session.id);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await request(`/__agent/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  applyEvent({ type: 'session-removed', sessionId: id });
}

function turnSettings(id: string) {
  const provider = state.full[id]?.provider ?? state.provider;
  const status = state.status?.providers.find((p) => p.id === provider);
  const choice = status ? resolveModelChoice(status.models, state.modelChoices[provider]) : null;
  return { model: choice?.model.id || null, effort: choice?.effort ?? null };
}

export async function sendMessage(
  id: string,
  text: string,
  context: AgentTurnContext | undefined,
  edit?: string,
): Promise<void> {
  await request(
    `/__agent/sessions/${encodeURIComponent(id)}/messages`,
    post({ text, context, ...turnSettings(id), edit }),
  );
}

export async function stopSession(id: string): Promise<void> {
  await request(`/__agent/sessions/${encodeURIComponent(id)}/stop`, post());
}

// Answers start the next turn, so they carry the same settings and context a
// new message would.
export async function respond(
  id: string,
  itemId: string,
  payload: RespondPayload,
  context: AgentTurnContext | undefined,
): Promise<void> {
  await request(
    `/__agent/sessions/${encodeURIComponent(id)}/respond`,
    post({ itemId, ...payload, context, ...turnSettings(id) }),
  );
}

export async function installProvider(provider: AgentProviderId): Promise<void> {
  setState((prev) => ({
    installing: provider,
    connectErrors: { ...prev.connectErrors, [provider]: undefined },
  }));
  try {
    await request('/__agent/install', post({ provider }));
    await refreshStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState((prev) => ({ connectErrors: { ...prev.connectErrors, [provider]: message } }));
    throw err;
  } finally {
    setState({ installing: null });
  }
}

let autoConnecting: Promise<void> | null = null;

/** Installs the SDK for an agent whose CLI is already here: nothing to decide. */
export function autoConnect(): Promise<void> {
  if (autoConnecting) return autoConnecting;
  const status = state.status;
  if (!status?.enabled) return Promise.resolve();
  const pending = status.providers.filter(
    (p) => p.cliFound && !p.ready && !state.connectErrors[p.id],
  );
  if (pending.length === 0) return Promise.resolve();
  autoConnecting = (async () => {
    for (const p of pending) await installProvider(p.id).catch(() => {});
  })().finally(() => {
    autoConnecting = null;
  });
  return autoConnecting;
}

export function setActiveSession(id: string | null): void {
  writeStorage(ACTIVE_KEY, id);
  setState({ activeId: id });
}

export function setModelChoice(provider: AgentProviderId, choice: ModelChoice): void {
  const modelChoices = { ...state.modelChoices, [provider]: choice };
  writeStorage(MODEL_KEY, JSON.stringify(modelChoices));
  writeStorage(PROVIDER_KEY, provider);
  setState({ modelChoices, provider });
}

export function resolveModelChoice(
  models: AgentModelOption[],
  choice: ModelChoice | undefined,
): { model: AgentModelOption; effort: AgentEffort | null } | null {
  const model = models.find((m) => m.id === choice?.model) ?? models[0];
  if (!model) return null;
  const effort = choice?.effort && model.efforts.includes(choice.effort) ? choice.effort : null;
  return { model, effort };
}

function resolveProvider(status: AgentStatus | null, preferred: AgentProviderId) {
  const ready = status?.enabled ? status.providers.filter((p) => p.ready) : [];
  return ready.find((p) => p.id === preferred) ?? ready[0] ?? null;
}

export function useAgentStatus() {
  const s = useAgentState();
  useEffect(() => {
    if (!agentAvailable || s.status) return;
    void refreshStatus();
  }, [s.status]);
  const provider = resolveProvider(s.status, s.provider);
  const choice = provider ? resolveModelChoice(provider.models, s.modelChoices[provider.id]) : null;
  return {
    status: s.status,
    loading: s.status === null && !s.statusError,
    enabled: agentAvailable && (s.status?.enabled ?? false),
    connected: provider !== null,
    provider,
    model: choice?.model ?? null,
    effort: choice?.effort ?? null,
    modelChoices: s.modelChoices,
  };
}

export function useAgentSessions() {
  const s = useAgentState();
  useEffect(() => {
    if (!agentAvailable || s.sessionsLoaded) return;
    void loadSessions();
  }, [s.sessionsLoaded]);
  return { sessions: s.sessions, loaded: s.sessionsLoaded, activeId: s.activeId };
}

export function useAgentSession(id: string | null): AgentSession | null {
  const s = useAgentState();
  const session = id ? (s.full[id] ?? null) : null;
  useEffect(() => {
    if (!agentAvailable || !id || session) return;
    void loadSession(id);
  }, [id, session]);
  return session;
}

export type AgentActivity = {
  provider: AgentProviderId;
  phase: 'thinking' | 'tool';
  title: string | null;
  detail: string | null;
};

/** What an agent is doing to this file right now, or null. */
export function useAgentActivity(frameId: string | null): AgentActivity | null {
  const { sessions } = useAgentSessions();
  const summary =
    (frameId && sessions.find((s) => s.frameId === frameId && s.status === 'running')) || null;
  const session = useAgentSession(summary?.id ?? null);
  if (!summary) return null;
  const last = session?.items.at(-1);
  if (last?.kind === 'tool' && last.status === 'running') {
    return { provider: summary.provider, phase: 'tool', title: last.title, detail: last.detail };
  }
  return { provider: summary.provider, phase: 'thinking', title: null, detail: null };
}

export function useAgentDockMemory(open: boolean): void {
  // The dev server reloads the page when a frame file is added, which an agent
  // does; the panel it was talking through must come back open.
  useEffect(() => {
    if (agentAvailable) writeStorage(AGENT_DOCK_KEY, open ? '1' : null);
  }, [open]);
}
