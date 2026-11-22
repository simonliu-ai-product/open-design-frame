import { describe, expect, it } from 'vitest';
import { CHECK_FINDINGS_KEPT, checkItemResult, framesToCheck } from './check-after-turn.ts';
import type { AgentItem } from './types.ts';

const at = '2026-11-06T08:00:00.000Z';
const startedMs = Date.parse(at);

const user: AgentItem = { kind: 'user', id: 'u1', ts: at, text: 'Tighten the hero' };
const tool: AgentItem = {
  kind: 'tool',
  id: 't1',
  ts: at,
  name: 'file_change',
  title: 'Edit',
  detail: 'frames/landing/index.tsx',
  status: 'done',
};
const done: AgentItem = {
  kind: 'result',
  id: 'r1',
  ts: at,
  durationMs: 1000,
  costUsd: null,
  aborted: false,
};

describe('framesToCheck', () => {
  const base = {
    session: { items: [user, tool, done] },
    userItemId: 'u1',
    canOpenBrowser: false,
    entries: [
      { id: 'landing', mtimeMs: startedMs + 5000 },
      { id: 'cards', mtimeMs: startedMs - 60_000 },
      { id: 'about', mtimeMs: startedMs + 100 },
    ],
  };

  it('picks the files a turn wrote, for an agent without a browser', () => {
    expect(framesToCheck(base)).toEqual(['about', 'landing']);
  });

  it('leaves it to an agent that can run the check itself', () => {
    expect(framesToCheck({ ...base, canOpenBrowser: true })).toEqual([]);
  });

  it('skips a turn in which the agent used no tool, however fresh the file', () => {
    expect(framesToCheck({ ...base, session: { items: [user, done] } })).toEqual([]);
  });

  it('allows for a file clock a little behind the message', () => {
    expect(framesToCheck({ ...base, entries: [{ id: 'x', mtimeMs: startedMs - 500 }] })).toEqual([
      'x',
    ]);
  });

  it('skips a stopped turn and an unknown message', () => {
    const stopped = { ...done, aborted: true } as AgentItem;
    expect(framesToCheck({ ...base, session: { items: [user, tool, stopped] } })).toEqual([]);
    expect(framesToCheck({ ...base, userItemId: 'u-missing' })).toEqual([]);
  });
});

describe('checkItemResult', () => {
  it('flattens the reports, errors first, keeping each file and artboard', () => {
    const result = checkItemResult([
      {
        id: 'landing',
        findings: [
          { rule: 'unlabeled-layer', severity: 'warn', message: 'no name', loc: '3:1' },
          {
            rule: 'frame-overflow',
            severity: 'error',
            message: 'past the edge',
            frame: 'Hero',
            loc: '12:4',
          },
        ],
      },
      { id: 'cards', findings: [{ rule: 'syntax-error', severity: 'error', message: 'parse' }] },
    ]);
    expect(result.total).toBe(3);
    expect(result.findings.map((f) => f.message)).toEqual(['past the edge', 'parse', 'no name']);
    expect(result.findings[0]).toEqual({
      frameId: 'landing',
      frame: 'Hero',
      severity: 'error',
      rule: 'frame-overflow',
      message: 'past the edge',
      loc: '12:4',
    });
    expect(result.findings[1]).toEqual({
      frameId: 'cards',
      severity: 'error',
      rule: 'syntax-error',
      message: 'parse',
    });
  });

  it(`keeps at most ${CHECK_FINDINGS_KEPT}`, () => {
    const findings = Array.from({ length: 30 }, (_, n) => ({
      rule: 'tiny-text' as const,
      severity: 'warn' as const,
      message: `w${n}`,
    }));
    const result = checkItemResult([{ id: 'a', findings }]);
    expect(result.findings).toHaveLength(CHECK_FINDINGS_KEPT);
    expect(result.total).toBe(30);
  });
});
