import { describe, expect, it } from 'vitest';
import { applyEdit } from './edit-ops.ts';

// Column is 0-based, line is 1-based — what the loc tag carries.
const SOURCE = `const Frame = () => (
  <div style={{ padding: 20 }}>
    <span style={{ fontSize: 24, color: '#111' }}>Hello</span>
    <p>Plain</p>
    <b style={SHARED}>Shared</b>
  </div>
);
`;

const SPAN = { line: 3, column: 4 };
const P = { line: 4, column: 4 };
const SHARED = { line: 5, column: 4 };

describe('style edits', () => {
  it('replaces a value that is already there', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'fontSize', value: '32px' },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.source).toContain("fontSize: 32, color: '#111'");
  });

  /*
   * `fontSize: 32`, not `'32px'`. React treats these as pixels already, and the
   * surrounding code writes them bare — a file that mixes both reads as two
   * authors.
   */
  it('writes pixel lengths the way the file already writes them', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'letterSpacing', value: '-0.5px' },
    ]);
    if (!out.ok) return;
    expect(out.source).toContain('letterSpacing: -0.5');
    expect(out.source).not.toContain("'-0.5px'");
  });

  it('keeps a colour as a string', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'color', value: '#ff0000' },
    ]);
    if (!out.ok) return;
    expect(out.source).toContain("color: '#ff0000'");
  });

  it('appends a property the element did not have', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'fontWeight', value: '700' },
    ]);
    if (!out.ok) return;
    // `fontWeight: 700`, not `'700'` — the property is a number, not a length.
    expect(out.source).toContain("color: '#111', fontWeight: 700");
  });

  it('gives a style object to an element with none', () => {
    const out = applyEdit(SOURCE, P.line, P.column, [
      { kind: 'set-style', key: 'fontSize', value: '18px' },
    ]);
    if (!out.ok) return;
    expect(out.source).toContain('<p style={{ fontSize: 18 }}>Plain</p>');
  });

  it('removes a property, and the comma with it', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'fontSize', value: null },
    ]);
    if (!out.ok) return;
    expect(out.source).toContain("style={{ color: '#111' }}");
  });

  /*
   * `style={SHARED}` is one value used by many elements. Rewriting it would
   * restyle all of them, which is not what dragging one slider means — so it is
   * refused with the reason rather than applied to the wrong scope.
   */
  it('refuses to edit a style that other elements share', () => {
    const out = applyEdit(SOURCE, SHARED.line, SHARED.column, [
      { kind: 'set-style', key: 'fontSize', value: '10px' },
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/shared value/);
  });
});

describe('text edits', () => {
  it('replaces the text and leaves the markup alone', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [{ kind: 'set-text', value: 'Goodbye' }]);
    if (!out.ok) return;
    expect(out.source).toContain('>Goodbye</span>');
    expect(out.source).toContain("fontSize: 24, color: '#111'");
  });

  it('escapes what would otherwise be JSX', () => {
    const out = applyEdit(SOURCE, P.line, P.column, [{ kind: 'set-text', value: 'a < b {c}' }]);
    if (!out.ok) return;
    expect(out.source).toContain("a {'<'} b {'{'}c{'}'}");
  });

  it('refuses an element whose children are not one run of text', () => {
    const out = applyEdit(SOURCE, 2, 2, [{ kind: 'set-text', value: 'x' }]);
    expect(out.ok).toBe(false);
  });
});

describe('the edit as a whole', () => {
  it('applies several ops in one pass', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, [
      { kind: 'set-style', key: 'fontSize', value: '40px' },
      { kind: 'set-style', key: 'color', value: '#00ff00' },
      { kind: 'set-text', value: 'Both' },
    ]);
    if (!out.ok) return;
    expect(out.source).toContain("fontSize: 40, color: '#00ff00'");
    expect(out.source).toContain('>Both</span>');
  });

  /* A caller that cannot tell "wrote nothing" from "wrote the same thing" will
     report success for an edit that did not happen. */
  it('says when nothing changed', () => {
    const out = applyEdit(SOURCE, SPAN.line, SPAN.column, []);
    expect(out).toEqual({ ok: true, source: SOURCE, changed: false });
  });

  it('reports a location that holds no element', () => {
    const out = applyEdit(SOURCE, 99, 0, [{ kind: 'set-text', value: 'x' }]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/no element at 99:0/);
  });
});
