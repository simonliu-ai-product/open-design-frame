// Anthropic does not allow a third-party product to run on a user's claude.ai
// login, so Claude Code is not offered; Antigravity waits for official support
// of third-party harnesses. A new agent is one more id here and one provider.
export const AGENT_PROVIDER_IDS = ['codex'] as const;

export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

// The levels the panel has words for. A model may offer others (a new level such
// as 'ultra'): those pass through as given and show under their own name.
export const AGENT_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export type KnownAgentEffort = (typeof AGENT_EFFORTS)[number];

export type AgentEffort = string;

export function isAgentProviderId(value: unknown): value is AgentProviderId {
  return typeof value === 'string' && (AGENT_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isAgentEffort(value: unknown): value is AgentEffort {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value);
}

export function isKnownAgentEffort(value: string): value is KnownAgentEffort {
  return (AGENT_EFFORTS as readonly string[]).includes(value);
}

/** A level the panel has no word for, under its own name: 'ultra' → 'Ultra'. */
export function plainEffortName(effort: string): string {
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

export type AgentModelOption = {
  // Empty when the option stands for the CLI's own default model.
  id: string;
  label: string;
  efforts: AgentEffort[];
};

export type AgentProviderStatus = {
  id: AgentProviderId;
  name: string;
  sdkPackage: string;
  sdkVersion: string | null;
  cliCommand: string;
  cliFound: boolean;
  cliVersion: string | null;
  ready: boolean;
  models: AgentModelOption[];
};

export type AgentStatus = {
  enabled: boolean;
  packageManager: string;
  providers: AgentProviderStatus[];
};

type AgentQuestionOption = { label: string; description?: string };

export type AgentQuestion = {
  header: string;
  question: string;
  options: AgentQuestionOption[];
  multiSelect: boolean;
};

export type AgentItem =
  | {
      kind: 'user';
      id: string;
      ts: string;
      text: string;
      // The provider history point just before this message, so editing it
      // can rewind the agent's conversation there.
      resumeAt?: string;
    }
  | { kind: 'assistant'; id: string; ts: string; text: string; streaming: boolean }
  | {
      kind: 'tool';
      id: string;
      ts: string;
      name: string;
      title: string;
      detail: string | null;
      status: 'running' | 'done' | 'error';
    }
  | {
      kind: 'question';
      id: string;
      ts: string;
      questions: AgentQuestion[];
      answers: Record<string, string> | null;
      status: 'pending' | 'answered' | 'cancelled';
    }
  | { kind: 'error'; id: string; ts: string; text: string }
  // `open-design-frame check`, run by the dev server after a turn whose agent
  // cannot start a browser itself, over the frame files the turn wrote.
  | {
      kind: 'check';
      id: string;
      ts: string;
      frameIds: string[];
      status: 'running' | 'done' | 'failed';
      // Whether the files were also drawn, which needs Playwright.
      rendered: boolean;
      // The first few findings; `total` counts them all.
      findings: AgentCheckFinding[];
      total: number;
      error: string | null;
    }
  | {
      kind: 'result';
      id: string;
      ts: string;
      durationMs: number | null;
      costUsd: number | null;
      aborted: boolean;
    };

export type AgentCheckFinding = {
  frameId: string;
  // The artboard a drawn finding is on.
  frame?: string;
  severity: 'error' | 'warn';
  rule: string;
  message: string;
  loc?: string;
};

type AgentSessionStatus = 'idle' | 'running';

export type AgentSessionSummary = {
  id: string;
  provider: AgentProviderId;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: AgentSessionStatus;
  frameId: string | null;
};

export type AgentSession = AgentSessionSummary & {
  providerSessionId: string | null;
  providerCheckpoint?: string | null;
  // Set once the oldest items were dropped to stay under the item cap.
  trimmed?: boolean;
  items: AgentItem[];
};

export type AgentTurnContext = {
  frameId?: string;
  frameTitle?: string;
  artboard?: { index: number; total: number; name: string; width: number; height: number };
  pendingComments?: number;
  selection?: { line: number; column: number; label: string; tagName: string; text: string } | null;
};

export type RespondPayload = { answers: Record<string, string> } | { cancel: true };

export type AgentStreamEvent =
  | { type: 'session'; session: AgentSessionSummary }
  | { type: 'session-removed'; sessionId: string }
  | { type: 'item'; sessionId: string; item: AgentItem }
  | { type: 'delta'; sessionId: string; itemId: string; text: string }
  | { type: 'truncate'; sessionId: string; itemId: string };

export function sessionSummary(session: AgentSession): AgentSessionSummary {
  const {
    providerSessionId: _p,
    providerCheckpoint: _c,
    trimmed: _t,
    items: _i,
    ...summary
  } = session;
  return summary;
}
