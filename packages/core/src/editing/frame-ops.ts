import * as t from '@babel/types';
import { SIZES } from '../app/lib/sdk.ts';
import { parseSource, walk } from './babel-walk.ts';

export function validateFrameName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length < 1 || trimmed.length > 80 ? null : trimmed;
}

const quote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function metaObject(ast: t.File): t.ObjectExpression | null {
  let found: t.ObjectExpression | null = null;
  for (const node of ast.program.body) {
    if (!t.isExportNamedDeclaration(node) || !t.isVariableDeclaration(node.declaration)) continue;
    for (const declarator of node.declaration.declarations) {
      if (!t.isIdentifier(declarator.id) || declarator.id.name !== 'meta') continue;
      if (t.isObjectExpression(declarator.init)) found = declarator.init;
    }
  }
  return found;
}

function lastImportEnd(ast: t.File): number {
  let end = 0;
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) end = node.end ?? end;
  }
  return end;
}

/**
 * The frame's title, written where the frame declares it.
 *
 * Renaming a frame does not rename its folder: the folder name is the id, and
 * the id is in the URL, in every asset path beside it and in whatever links to
 * it. A title is what a person reads; an id is what everything else uses.
 */
export function setMetaTitle(source: string, title: string): string | null {
  const ast = parseSource(source);
  if (!ast) return null;
  const literal = quote(title);

  const meta = metaObject(ast);
  if (meta) {
    for (const property of meta.properties) {
      if (!t.isObjectProperty(property) || property.computed) continue;
      const key = t.isIdentifier(property.key)
        ? property.key.name
        : t.isStringLiteral(property.key)
          ? property.key.value
          : null;
      if (key !== 'title') continue;
      const value = property.value;
      if (value.start === undefined || value.end === undefined) return null;
      return source.slice(0, value.start ?? 0) + literal + source.slice(value.end ?? 0);
    }
    // A meta without a title: add one rather than replace what is there.
    const at = (meta.start ?? 0) + 1;
    const spaced = meta.properties.length === 0 ? ` title: ${literal} ` : ` title: ${literal},`;
    return source.slice(0, at) + spaced + source.slice(at);
  }

  const at = lastImportEnd(ast);
  const block = `export const meta = { title: ${literal} };`;
  return at === 0
    ? `${block}\n\n${source}`
    : `${source.slice(0, at)}\n\n${block}${source.slice(at)}`;
}

/** `flow-dashboard` → `flow-dashboard-copy`, then `-copy-2`, and so on. */
export function nextCopyId(id: string, taken: readonly string[]): string {
  const base = `${id}-copy`;
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export type FrameSummary = {
  name: string;
  size: { width: number; height: number } | null;
  url: string | null;
};

export type FileSummary = { title: string | null; frames: FrameSummary[] };

function stringOf(node: t.Node | null | undefined): string | null {
  return node && t.isStringLiteral(node) ? node.value : null;
}

function sizeOf(node: t.Node | null | undefined): { width: number; height: number } | null {
  // `SIZES.DESKTOP` — the named presets, read from the same table the viewer uses.
  if (node && t.isMemberExpression(node) && t.isIdentifier(node.object, { name: 'SIZES' })) {
    const key = t.isIdentifier(node.property) ? node.property.name : null;
    const preset = key ? (SIZES as Record<string, { width: number; height: number }>)[key] : null;
    return preset ?? null;
  }
  if (node && t.isObjectExpression(node)) {
    const read = (name: string): number | null => {
      for (const prop of node.properties) {
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key, { name })) continue;
        if (t.isNumericLiteral(prop.value)) return prop.value.value;
      }
      return null;
    };
    const width = read('width');
    const height = read('height');
    return width !== null && height !== null ? { width, height } : null;
  }
  return null;
}

/**
 * What a frame file declares, read rather than run.
 *
 * The names and sizes are runtime values on the components, but they are always
 * written as literals beside them — so an agent can be told what is in a file
 * without a bundler, a browser, or the chance of running someone's code.
 */
export function readFileSummary(source: string): FileSummary {
  const ast = parseSource(source);
  if (!ast) return { title: null, frames: [] };

  const meta = metaObject(ast);
  let title: string | null = null;
  if (meta) {
    for (const prop of meta.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) continue;
      if (!t.isIdentifier(prop.key, { name: 'title' })) continue;
      title = stringOf(prop.value as t.Node);
    }
  }

  const declared = new Map<string, FrameSummary>();
  const touch = (name: string): FrameSummary => {
    const found = declared.get(name);
    if (found) return found;
    const made: FrameSummary = { name, size: null, url: null };
    declared.set(name, made);
    return made;
  };

  walk(ast.program.body, (node) => {
    if (!t.isAssignmentExpression(node) || !t.isMemberExpression(node.left)) return;
    const { object, property } = node.left;
    if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;
    const entry = touch(object.name);
    if (property.name === 'frameName') entry.name = stringOf(node.right) ?? entry.name;
    if (property.name === 'url') entry.url = stringOf(node.right);
    if (property.name === 'size') entry.size = sizeOf(node.right);
  });

  // The default export is the order they are drawn in; anything else is a
  // component that happens to carry a name.
  const order: string[] = [];
  for (const node of ast.program.body) {
    if (!t.isExportDefaultDeclaration(node) || !t.isArrayExpression(node.declaration)) continue;
    for (const element of node.declaration.elements) {
      if (t.isIdentifier(element)) order.push(element.name);
    }
  }

  return {
    title,
    frames: order.map((name) => declared.get(name) ?? { name, size: null, url: null }),
  };
}
