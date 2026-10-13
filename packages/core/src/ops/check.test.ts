import { describe, expect, it } from 'vitest';
import { checkFrameSource } from './check.ts';

describe('checkFrameSource', () => {
  it('passes a valid multi-frame file with prototype links', () => {
    const source = `import { type Frame, Layer, SIZES } from '@open-design-frame/core';
export const meta = { title: 'Valid' };
const A: Frame = () => <Layer name="Card" to="B · Phone">Go</Layer>;
A.frameName = 'A · Desktop';
A.size = SIZES.DESKTOP;
const B: Frame = () => <Layer name="Back" to="A · Desktop">Back</Layer>;
B.frameName = 'B · Phone';
B.size = SIZES.PHONE;
export default [A, B];
`;
    const res = checkFrameSource(source);
    expect(res.frameCount).toBe(2);
    expect(res.findings).toEqual([]);
  });

  it('catches unresolved <Layer to="..."> prototype links and duplicate frame names', () => {
    const source = `import { type Frame, Layer } from '@open-design-frame/core';
const A: Frame = () => <Layer name="Btn" to="Missing · Screen">Go</Layer>;
A.frameName = 'Same';
const B: Frame = () => <Layer name="Other">Hi</Layer>;
B.frameName = 'Same';
export default [A, B];
`;
    const res = checkFrameSource(source);
    const rules = res.findings.map((f) => f.rule);
    expect(rules).toContain('unresolved-link');
    expect(rules).toContain('duplicate-frame-name');
  });

  it('catches syntax errors and empty default exports', () => {
    expect(checkFrameSource('const x = <div').findings[0]?.rule).toBe('syntax-error');
    expect(checkFrameSource('export default [];').findings[0]?.rule).toBe('empty-export');
  });
});
