import { randomUUID } from 'node:crypto';
import * as t from '@babel/types';
import { parseSource, walk } from './babel-walk.ts';

/**
 * A comment lives in the frame's own source, as a JSX comment.
 *
 * Not in a database beside it: the note and the markup it is about travel
 * together through git, a rename, a branch and a review, and a note whose
 * element was deleted disappears with it rather than pointing at a line that
 * now says something else.
 */
const MARKER_RE =
  /\{\/\*\s*@frame-comment\s+id="(c-[a-f0-9]+)"\s+ts="([^"]+)"\s+text="([A-Za-z0-9_-]+={0,2})"\s*\*\/\}/;

export type FrameComment = { id: string; line: number; ts: string; note: string };

export type CommentResult =
  | { ok: true; source: string; id: string; line: number }
  | { ok: false; status: number; error: string };

export function encodeNote(note: string): string {
  return Buffer.from(note, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeNote(encoded: string): string {
  const pad = encoded.length % 4 === 0 ? '' : '='.repeat(4 - (encoded.length % 4));
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString(
    'utf8',
  );
}

export function parseComments(source: string): FrameComment[] {
  const out: FrameComment[] = [];
  source.split('\n').forEach((line, i) => {
    const m = MARKER_RE.exec(line);
    if (!m) return;
    const [, id, ts, encoded] = m;
    if (!id || !ts || !encoded) return;
    try {
      const payload = JSON.parse(decodeNote(encoded)) as { note?: unknown };
      if (typeof payload.note !== 'string') return;
      out.push({ id, line: i + 1, ts, note: payload.note });
    } catch {
      // A marker we cannot read is not a comment; leaving it in the file is
      // kinder than reporting half of one.
    }
  });
  return out;
}

function markerRegexFor(id: string): RegExp {
  return new RegExp(
    `\\{\\/\\*\\s*@frame-comment\\s+id="${id}"\\s+ts="[^"]+"\\s+text="[A-Za-z0-9_-]+={0,2}"\\s*\\*\\/\\}`,
  );
}

type Container = t.JSXElement | t.JSXFragment;

function indentAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart, offset))?.[0] ?? '';
}

/**
 * Where the marker goes: inside the innermost element that can hold children.
 *
 * A JSX comment is only a comment where JSX children are expected. Written
 * anywhere else — as the body of `() => ( … )`, say — it parses as an empty
 * object and takes the expression around it with it. So a self-closing element
 * hands the note to the nearest ancestor that has a body.
 */
function insertionFor(source: string, line: number, column: number): number | null {
  const ast = parseSource(source);
  if (!ast) return null;

  const hits: { node: Container; size: number }[] = [];
  walk(ast.program.body, (node) => {
    if (!node.loc || !(t.isJSXElement(node) || t.isJSXFragment(node))) return;
    const { start, end } = node.loc;
    const afterStart = line > start.line || (line === start.line && column >= start.column);
    const beforeEnd = line < end.line || (line === end.line && column < end.column);
    if (afterStart && beforeEnd) hits.push({ node, size: (node.end ?? 0) - (node.start ?? 0) });
  });
  hits.sort((a, b) => a.size - b.size);

  for (const { node } of hits) {
    if (t.isJSXFragment(node)) return node.openingFragment.end ?? null;
    if (!node.openingElement.selfClosing) return node.openingElement.end ?? null;
  }
  return null;
}

export function addComment(
  source: string,
  line: number,
  column: number,
  note: string,
): CommentResult {
  const trimmed = note.trim();
  if (trimmed === '') return { ok: false, status: 400, error: 'a comment needs something in it' };

  const offset = insertionFor(source, line, column);
  if (offset === null) {
    return {
      ok: false,
      status: 422,
      error: `nothing at ${line}:${column} can hold a note — try selecting the element around it`,
    };
  }

  const id = `c-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const ts = new Date().toISOString();
  const payload = encodeNote(JSON.stringify({ note: trimmed }));
  const marker = `{/* @frame-comment id="${id}" ts="${ts}" text="${payload}" */}`;

  /*
   * On its own line where the element's children start on one, inline where
   * they do not. Removing a comment then only ever has to take back exactly
   * what was added: a marker line that is nothing else can go, and an inline
   * one leaves the text it sits in front of untouched.
   */
  const restOfLine = source.slice(offset, source.indexOf('\n', offset) + 1 || source.length);
  const ownLine = restOfLine.trim() === '';
  const text = ownLine ? `\n${indentAt(source, offset)}  ${marker}` : marker;
  const next = `${source.slice(0, offset)}${text}${source.slice(offset)}`;
  const markerLine = next.slice(0, offset + 1).split('\n').length;
  return { ok: true, source: next, id, line: markerLine };
}

export function removeComment(
  source: string,
  id: string,
): { ok: true; source: string } | { ok: false; status: number; error: string } {
  if (!/^c-[a-f0-9]+$/.test(id)) return { ok: false, status: 400, error: 'not a comment id' };
  const lines = source.split('\n');
  const re = markerRegexFor(id);
  const hit = lines.findIndex((line) => re.test(line));
  if (hit === -1) return { ok: false, status: 404, error: `no comment ${id} in this frame` };
  const stripped = (lines[hit] ?? '').replace(re, '');
  if (stripped.trim() === '') lines.splice(hit, 1);
  else lines[hit] = stripped;
  return { ok: true, source: lines.join('\n') };
}
