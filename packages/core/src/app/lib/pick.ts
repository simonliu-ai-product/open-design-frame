import { LOC_ATTR } from '../../editing/loc.ts';
import { LAYER_ATTR, LAYER_ID_ATTR } from './layers.ts';

/**
 * What the panel is pointed at, in terms that survive a re-render.
 *
 * A DOM node does not: an edit reloads the module and every element in the
 * frame is a new object, so a held reference would go stale exactly when the
 * panel is supposed to show the result. A named layer is found again by its id,
 * and anything else by where it is written plus which of that line's renders it
 * was — one JSX site inside a `map` is many elements.
 */
export type Pick = { id: string | null; loc: string | null; nth: number };

const SELECTABLE = `[${LOC_ATTR}],[${LAYER_ID_ATTR}]`;
const LOC_RE = /^\d+:\d+$/;

const quote = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** The innermost thing under the pointer that the source knows about. */
export function pickAt(host: HTMLElement, x: number, y: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement) || !host.contains(el)) continue;
    const target = el.closest<HTMLElement>(SELECTABLE);
    if (target && host.contains(target)) return target;
  }
  return null;
}

export function pickOf(host: HTMLElement, el: HTMLElement): Pick {
  const loc = el.getAttribute(LOC_ATTR);
  const usable = loc && LOC_RE.test(loc) ? loc : null;
  const nth = usable
    ? [...host.querySelectorAll<HTMLElement>(`[${LOC_ATTR}="${usable}"]`)].indexOf(el)
    : 0;
  return { id: el.getAttribute(LAYER_ID_ATTR), loc: usable, nth: nth < 0 ? 0 : nth };
}

export function resolvePick(host: HTMLElement, pick: Pick): HTMLElement | null {
  if (pick.id !== null) {
    const byId = host.querySelector<HTMLElement>(`[${LAYER_ID_ATTR}="${quote(pick.id)}"]`);
    if (byId) return byId;
  }
  if (pick.loc !== null && LOC_RE.test(pick.loc)) {
    const all = host.querySelectorAll<HTMLElement>(`[${LOC_ATTR}="${pick.loc}"]`);
    return all[pick.nth] ?? all[0] ?? null;
  }
  return null;
}

export function samePick(a: Pick | null, b: Pick | null): boolean {
  if (a === null || b === null) return a === b;
  return a.id === b.id && a.loc === b.loc && a.nth === b.nth;
}

/** What to call it in the panel: the name the author gave it, else its tag. */
export function labelOf(el: HTMLElement): string {
  return el.getAttribute(LAYER_ATTR) || `<${el.tagName.toLowerCase()}>`;
}
