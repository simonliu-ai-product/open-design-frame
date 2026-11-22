import type { FrameCheckReport } from '../ops/check.ts';
import type { AgentCheckFinding, AgentItem, AgentSession } from './types.ts';

/** How many findings a check item keeps; the rest are only counted. */
export const CHECK_FINDINGS_KEPT = 20;

// A file's mtime can trail the clock that stamped the message by a little.
const CLOCK_SLACK_MS = 1000;

/**
 * The frame files the dev server should check for the turn that just ended:
 * only for an agent that cannot start a browser itself, only when the turn ran
 * to its end, and only files it wrote — it used a tool, and the file changed
 * after the message. The mtime alone is not enough: a file made from a
 * template a moment earlier reads as fresh to a turn whose agent never even
 * started.
 */
export function framesToCheck(opts: {
  session: Pick<AgentSession, 'items'>;
  userItemId: string;
  canOpenBrowser: boolean;
  entries: { id: string; mtimeMs: number }[];
}): string[] {
  const { session, userItemId, canOpenBrowser, entries } = opts;
  if (canOpenBrowser) return [];
  const start = session.items.findIndex((i) => i.id === userItemId);
  const message = session.items[start];
  if (!message) return [];
  const turn = session.items.slice(start + 1);
  const result = [...turn].reverse().find((i) => i.kind === 'result');
  if (result?.kind === 'result' && result.aborted) return [];
  if (!turn.some((i) => i.kind === 'tool')) return [];
  const startedAt = Date.parse(message.ts);
  if (!Number.isFinite(startedAt)) return [];
  return entries
    .filter((e) => e.mtimeMs >= startedAt - CLOCK_SLACK_MS)
    .map((e) => e.id)
    .sort();
}

/** Check reports as the transcript keeps them: errors first, the rest counted. */
export function checkItemResult(
  reports: Pick<FrameCheckReport, 'id' | 'findings'>[],
): Pick<Extract<AgentItem, { kind: 'check' }>, 'findings' | 'total'> {
  const all: AgentCheckFinding[] = reports.flatMap((r) =>
    r.findings.map((f) => ({
      frameId: r.id,
      ...(f.frame ? { frame: f.frame } : {}),
      severity: f.severity,
      rule: f.rule,
      message: f.message,
      ...(f.loc ? { loc: f.loc } : {}),
    })),
  );
  const ordered = all
    .map((f, n) => ({ f, n }))
    .sort(
      (a, b) => Number(b.f.severity === 'error') - Number(a.f.severity === 'error') || a.n - b.n,
    )
    .map(({ f }) => f);
  return { findings: ordered.slice(0, CHECK_FINDINGS_KEPT), total: all.length };
}
