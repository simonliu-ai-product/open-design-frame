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
 *
 * `changed: false` is not success. It means the file already said what the edit
 * asked for, or the target could not be reached — either way nothing happened,
 * and a caller that treats it as a write reports a save that was not one.
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
