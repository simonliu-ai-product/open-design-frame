import { LOC_ATTR } from '../../editing/loc.ts';

export type EditOp =
  | { kind: 'set-style'; key: string; value: string | null }
  | { kind: 'set-text'; value: string };

export type Loc = { line: number; column: number };

export function locOf(element: HTMLElement): Loc | null {
  const raw = element.closest(`[${LOC_ATTR}]`)?.getAttribute(LOC_ATTR);
  if (!raw) return null;
  const [line, column] = raw.split(':').map(Number);
  if (!Number.isFinite(line) || !Number.isFinite(column)) return null;
  return { line: line as number, column: column as number };
}

/**
 * Sends one element's edits to the dev server, which rewrites the source.
 */
export async function applyEdit(
  frameId: string,
  loc: Loc,
  ops: EditOp[],
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const res = await fetch('/__edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ frameId, line: loc.line, column: loc.column, ops }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; changed?: boolean };
  if (!res.ok) return { ok: false, error: body.error ?? `POST /__edit → ${res.status}` };
  return { ok: true, changed: body.changed === true };
}

/**
 * Queries the dev server for the AST style origins of the element at `loc`
 * (e.g. `{ from: 'CARD', properties: { padding: 'CARD', color: null } }`).
 */
export async function fetchStyleOrigins(
  frameId: string,
  loc: Loc,
): Promise<{ from: string | null; properties: Record<string, string | null> } | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const q = new URLSearchParams({
      frameId,
      line: String(loc.line),
      column: String(loc.column),
    });
    const res = await fetch(`/__edit?${q.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      origins?: Record<string, { value: string; from?: string }>;
    };
    const origins = data.origins ?? {};
    const properties: Record<string, string | null> = {};
    let firstFrom: string | null = null;
    for (const [k, v] of Object.entries(origins)) {
      properties[k] = v.from ?? null;
      if (!firstFrom && v.from) firstFrom = v.from;
    }
    return { from: firstFrom, properties };
  } catch {
    return null;
  }
}

/**
 * Reports the active frame and selection to `/__current` so CLI and MCP tools
 * (`current_frame`) know what the designer is looking at.
 */
export async function reportCurrentFrame(state: {
  frameId: string | null;
  frameIndex?: number;
  frameName?: string | null;
  selectedLoc?: { line: number; column: number; label?: string } | null;
}): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    await fetch('/__current', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // Non-fatal in static builds or when server is unreachable.
  }
}
