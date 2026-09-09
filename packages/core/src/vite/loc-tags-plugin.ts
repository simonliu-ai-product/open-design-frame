import path from 'node:path';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { Plugin } from 'vite';
import { LOC_ATTR } from '../editing/loc.ts';

export { LOC_ATTR };

/**
 * Stamps `data-of-loc="<line>:<col>"` onto every host element a frame renders.
 *
 * The alternative is React's `_debugSource` on the fiber, which goes stale the
 * moment HMR replaces a module — the inspector then edits whatever used to be
 * at that spot. An attribute is part of the render, so it cannot disagree with
 * what is on screen.
 */
/**
 * Components that hand the attribute down to the element they render.
 *
 * A capitalised name is normally skipped: its location is the call site, not
 * the markup a click lands on. `Layer` is the exception because it renders one
 * host element and nothing else — the call site *is* where that element is
 * written, and it is the thing a designer names and selects.
 */
const FORWARDING = new Set(['Layer']);

function taggable(name: t.JSXOpeningElement['name']): name is t.JSXIdentifier {
  return t.isJSXIdentifier(name) && (/^[a-z]/.test(name.name) || FORWARDING.has(name.name));
}

function tagged(opening: t.JSXOpeningElement): boolean {
  return opening.attributes.some(
    (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === LOC_ATTR,
  );
}

export function injectLocTags(code: string): string | null {
  let ast: t.File;
  try {
    ast = babelParse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return null;
  }

  const insertions: { offset: number; text: string }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const value = node as t.Node;
    if (t.isJSXElement(value) && value.loc) {
      const opening = value.openingElement;
      if (taggable(opening.name) && !tagged(opening)) {
        insertions.push({
          offset: opening.name.end ?? 0,
          text: ` ${LOC_ATTR}="${value.loc.start.line}:${value.loc.start.column}"`,
        });
      }
    }
    for (const key of Object.keys(value)) {
      if (key === 'loc') continue;
      visit((value as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(ast.program.body);

  if (insertions.length === 0) return null;
  // Back to front, so an earlier insertion does not move a later offset.
  insertions.sort((a, b) => b.offset - a.offset);
  let next = code;
  for (const ins of insertions) {
    next = next.slice(0, ins.offset) + ins.text + next.slice(ins.offset);
  }
  return next;
}

export type LocTagsPluginOptions = { framesRoot: string };

export function locTagsPlugin(opts: LocTagsPluginOptions): Plugin {
  const root = path.resolve(opts.framesRoot);
  return {
    name: 'open-frame:loc-tags',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? '';
      if (!file.startsWith(root) || !/\.[jt]sx$/.test(file)) return null;
      const next = injectLocTags(code);
      return next === null ? null : { code: next, map: null };
    },
  };
}
