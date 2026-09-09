import * as t from '@babel/types';
import { parseSource, walk } from './babel-walk.ts';

export type EditOp =
  | { kind: 'set-style'; key: string; value: string | null }
  | { kind: 'set-text'; value: string };

export type EditResult =
  | { ok: true; source: string; changed: boolean }
  | { ok: false; status: number; error: string };

type Splice = { start: number; end: number; text: string };

function elementAt(ast: t.File, line: number, column: number): t.JSXElement | null {
  let found: t.JSXElement | null = null;
  walk(ast.program.body, (node) => {
    if (found || !t.isJSXElement(node) || !node.loc) return;
    if (node.loc.start.line === line && node.loc.start.column === column) found = node;
  });
  return found;
}

/** `fontSize` → the identifier a style object uses; `font-size` is the CSS spelling. */
const camel = (key: string): string => key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * A style value written the way a person would have written it.
 *
 * `16` rather than `'16px'` for the properties React treats as pixel lengths,
 * because that is what the surrounding code says and a file that mixes both
 * reads as two authors.
 */
const UNITLESS_PX = new Set(['fontSize', 'lineHeight', 'letterSpacing', 'width', 'height']);

/** Properties whose value is a number, never a length: `fontWeight: 700`. */
const NUMERIC = new Set(['fontWeight', 'opacity', 'zIndex', 'flexGrow', 'flexShrink', 'order']);

function literalFor(key: string, value: string): string {
  const trimmed = value.trim();
  if (UNITLESS_PX.has(key)) {
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(trimmed);
    if (px?.[1] !== undefined) return px[1];
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  }
  if (NUMERIC.has(key) && /^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  return quote(trimmed);
}

function styleObject(opening: t.JSXOpeningElement): t.ObjectExpression | null {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name) || attr.name.name !== 'style') {
      continue;
    }
    const value = attr.value;
    if (t.isJSXExpressionContainer(value) && t.isObjectExpression(value.expression)) {
      return value.expression;
    }
    return null;
  }
  return null;
}

function propertyNamed(obj: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of obj.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const name = t.isIdentifier(prop.key)
      ? prop.key.name
      : t.isStringLiteral(prop.key)
        ? prop.key.value
        : null;
    if (name !== null && camel(name) === key) return prop;
  }
  return null;
}

/**
 * Style edits, written into the element's own `style` object.
 *
 * A frame that styles itself through a shared constant (`style={CARD}`) is left
 * alone: rewriting that constant would silently restyle every element using it,
 * which is not what dragging one slider means.
 */
function styleSplices(
  source: string,
  element: t.JSXElement,
  ops: { key: string; value: string | null }[],
): Splice[] | { error: string } {
  const opening = element.openingElement;
  const obj = styleObject(opening);

  if (!obj) {
    const hasStyleAttr = opening.attributes.some(
      (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'style',
    );
    if (hasStyleAttr) {
      return {
        error:
          'this element takes its style from a shared value — edit that value, or give the element its own style object',
      };
    }
    const additions = ops
      .filter((op) => op.value !== null)
      .map((op) => `${camel(op.key)}: ${literalFor(camel(op.key), op.value as string)}`);
    if (additions.length === 0) return [];
    return [
      {
        start: opening.name.end ?? 0,
        end: opening.name.end ?? 0,
        text: ` style={{ ${additions.join(', ')} }}`,
      },
    ];
  }

  const splices: Splice[] = [];
  const appended: string[] = [];
  for (const op of ops) {
    const key = camel(op.key);
    const existing = propertyNamed(obj, key);
    if (existing) {
      if (op.value === null) {
        /*
         * The separator goes with the property, or the object is left holding a
         * dangling comma or a doubled space. Which separator depends on where
         * the property sits: everything but the last one owns the comma after
         * it, and the last one owns the comma before it.
         */
        const after = source.slice(existing.end ?? 0);
        const trailing = /^\s*,\s*/.exec(after);
        let start = existing.start ?? 0;
        let end = existing.end ?? 0;
        if (trailing) {
          end += trailing[0].length;
        } else {
          const before = /,\s*$/.exec(source.slice(0, start));
          if (before) start -= before[0].length;
        }
        splices.push({ start, end, text: '' });
      } else {
        splices.push({
          start: existing.value.start ?? 0,
          end: existing.value.end ?? 0,
          text: literalFor(key, op.value),
        });
      }
      continue;
    }
    if (op.value !== null) appended.push(`${key}: ${literalFor(key, op.value)}`);
  }

  if (appended.length > 0) {
    const last = obj.properties.at(-1);
    const text = appended.join(', ');
    if (last) {
      splices.push({ start: last.end ?? 0, end: last.end ?? 0, text: `, ${text}` });
    } else {
      splices.push({
        start: (obj.start ?? 0) + 1,
        end: (obj.start ?? 0) + 1,
        text: ` ${text} `,
      });
    }
  }
  return splices;
}

/** Text edits, for an element whose children are one run of literal text. */
function textSplice(element: t.JSXElement, value: string): Splice | { error: string } {
  const children = element.children.filter((child) => {
    if (t.isJSXText(child) && child.value.trim() === '') return false;
    // A `{/* … */}` marker is a note about the element, not part of its text.
    if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)) return false;
    return true;
  });
  const only = children[0];
  if (children.length !== 1 || !only || !t.isJSXText(only)) {
    return { error: 'this element does not hold a single run of text' };
  }
  const raw = only.value;
  const leading = /^\s*/.exec(raw)?.[0] ?? '';
  const trailing = /\s*$/.exec(raw)?.[0] ?? '';
  const escaped = value.replace(/[{}<>]/g, (c) => `{'${c}'}`);
  return {
    start: (only.start ?? 0) + leading.length,
    end: (only.end ?? 0) - trailing.length,
    text: escaped,
  };
}

export function applyEdit(source: string, line: number, column: number, ops: EditOp[]): EditResult {
  if (ops.length === 0) return { ok: true, source, changed: false };

  const ast = parseSource(source);
  if (!ast) return { ok: false, status: 422, error: 'could not parse the frame source' };
  const element = elementAt(ast, line, column);
  if (!element) return { ok: false, status: 422, error: `no element at ${line}:${column}` };

  const splices: Splice[] = [];

  const styles = ops.flatMap((op) =>
    op.kind === 'set-style' ? [{ key: op.key, value: op.value }] : [],
  );
  if (styles.length > 0) {
    const result = styleSplices(source, element, styles);
    if ('error' in result) return { ok: false, status: 422, error: result.error };
    splices.push(...result);
  }

  for (const op of ops) {
    if (op.kind !== 'set-text') continue;
    const result = textSplice(element, op.value);
    if ('error' in result) return { ok: false, status: 422, error: result.error };
    splices.push(result);
  }

  if (splices.length === 0) return { ok: true, source, changed: false };

  // Back to front: an earlier rewrite would move every offset after it.
  const ordered = [...splices].sort((a, b) => b.start - a.start);
  let next = source;
  for (const splice of ordered) {
    next = next.slice(0, splice.start) + splice.text + next.slice(splice.end);
  }
  return { ok: true, source: next, changed: next !== source };
}
