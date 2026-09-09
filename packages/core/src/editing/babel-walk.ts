import { parse as babelParse } from '@babel/parser';
import type * as t from '@babel/types';

export function parseSource(code: string): t.File | null {
  try {
    return babelParse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch {
    return null;
  }
}

export function walk(node: unknown, visit: (node: t.Node) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const value = node as t.Node;
  if (typeof value.type === 'string') visit(value);
  for (const key of Object.keys(value)) {
    if (key === 'loc') continue;
    walk((value as unknown as Record<string, unknown>)[key], visit);
  }
}
