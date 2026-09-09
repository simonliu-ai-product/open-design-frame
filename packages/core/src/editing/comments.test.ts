import { describe, expect, it } from 'vitest';
import { addComment, parseComments, removeComment } from './comments.ts';
import { applyEdit } from './edit-ops.ts';

// Column is 0-based, line is 1-based — what the loc tag carries.
const SOURCE = `const Frame = () => (
  <div style={{ padding: 20 }}>
    <span style={{ fontSize: 24 }}>Hello</span>
    <img src="./assets/logo.png" alt="" />
  </div>
);
`;

const DIV = { line: 2, column: 2 };
const SPAN = { line: 3, column: 4 };
const IMG = { line: 4, column: 4 };

function noteOn(source: string, at: { line: number; column: number }, note: string) {
  const out = addComment(source, at.line, at.column, note);
  expect(out.ok).toBe(true);
  if (!out.ok) throw new Error(out.error);
  return out;
}

describe('adding a comment', () => {
  it('writes a marker inside the element it is about', () => {
    const out = noteOn(SOURCE, DIV, 'Too tight');
    expect(out.line).toBe(3);
    expect(out.source.split('\n')[out.line - 1]?.trim()).toMatch(/^\{\/\* @frame-comment/);
  });

  /* An element whose text starts on the opening line keeps it there. */
  it('sits inline when the children do', () => {
    const out = noteOn(SOURCE, SPAN, 'Too big at this size');
    expect(out.line).toBe(3);
    expect(out.source.split('\n')[2]).toContain('}}>{/* @frame-comment');
    expect(out.source.split('\n')[2]).toContain('*/}Hello</span>');
  });

  it('reads back what was written, unicode and quotes included', () => {
    const note = '這裡的 "字級" 太大 — 想小一點';
    const out = noteOn(SOURCE, SPAN, note);
    const comments = parseComments(out.source);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.note).toBe(note);
    expect(comments[0]?.line).toBe(out.line);
  });

  /*
   * A JSX comment is only a comment where children are expected. Written into a
   * self-closing element it would land in the attribute list, so the note goes
   * to the nearest ancestor that has a body instead of being refused.
   */
  it('hoists a note on a self-closing element to its parent', () => {
    const out = noteOn(SOURCE, IMG, 'Swap this logo');
    expect(out.source).toContain('<div style={{ padding: 20 }}>\n    {/* @frame-comment');
    expect(out.source).toContain('<img src="./assets/logo.png" alt="" />');
  });

  it('keeps every note, on the same element or not', () => {
    const first = noteOn(SOURCE, SPAN, 'one');
    const second = noteOn(first.source, DIV, 'two');
    expect(
      parseComments(second.source)
        .map((c) => c.note)
        .sort(),
    ).toEqual(['one', 'two']);
  });

  it('refuses a note with nothing in it', () => {
    const out = addComment(SOURCE, SPAN.line, SPAN.column, '   ');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(400);
  });

  it('refuses a position that is not in any JSX', () => {
    const out = addComment(SOURCE, 1, 0, 'nowhere');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(422);
  });
});

describe('removing a comment', () => {
  it('takes the whole line with it', () => {
    const inline = noteOn(SOURCE, SPAN, 'gone soon');
    const afterInline = removeComment(inline.source, inline.id);
    expect(afterInline.ok).toBe(true);
    if (!afterInline.ok) return;
    expect(afterInline.source).toBe(SOURCE);

    const block = noteOn(SOURCE, DIV, 'gone soon');
    const afterBlock = removeComment(block.source, block.id);
    expect(afterBlock.ok).toBe(true);
    if (!afterBlock.ok) return;
    expect(afterBlock.source).toBe(SOURCE);
  });

  it('reports an id that is not in this frame', () => {
    const out = removeComment(SOURCE, 'c-deadbeef');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(404);
  });

  it('refuses something that is not an id', () => {
    const out = removeComment(SOURCE, '../../etc/passwd');
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.status).toBe(400);
  });
});

/*
 * The marker is a child of the element it is about, and text editing rejects an
 * element that holds anything but one run of text — so a commented element has
 * to stay editable, or leaving a note would cost the ability to act on it.
 */
describe('a commented element', () => {
  it('can still have its text edited', () => {
    const added = noteOn(SOURCE, SPAN, 'reword this');
    const marked = added.source;
    const out = applyEdit(marked, SPAN.line, SPAN.column, [{ kind: 'set-text', value: 'Hi' }]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.source).toContain('*/}Hi</span>');
    expect(parseComments(out.source)).toHaveLength(1);
  });
});
