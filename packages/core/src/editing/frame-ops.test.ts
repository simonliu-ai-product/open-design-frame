import { describe, expect, it } from 'vitest';
import { nextCopyId, setMetaTitle, validateFrameName } from './frame-ops.ts';

const WITH_TITLE = `import { SIZES } from '@open-frame/core';

export const meta = { title: 'Ember — Onboarding', createdAt: '2026-09-01' };

export default [];
`;

describe('naming a frame', () => {
  it('tidies a usable name and refuses an unusable one', () => {
    expect(validateFrameName('  Brand   sheet ')).toBe('Brand sheet');
    expect(validateFrameName('   ')).toBeNull();
    expect(validateFrameName(42)).toBeNull();
    expect(validateFrameName('x'.repeat(81))).toBeNull();
  });

  it('replaces the title and leaves the rest of meta alone', () => {
    const out = setMetaTitle(WITH_TITLE, 'Ember — Welcome');
    expect(out).toContain("title: 'Ember — Welcome'");
    expect(out).toContain("createdAt: '2026-09-01'");
  });

  it('escapes a quote rather than breaking the file', () => {
    const out = setMetaTitle(WITH_TITLE, "Don't panic");
    expect(out).toContain("title: 'Don\\'t panic'");
  });

  it('adds a title to a meta that has none', () => {
    const out = setMetaTitle("export const meta = { createdAt: '2026-09-01' };\n", 'Named at last');
    expect(out).toBe("export const meta = { title: 'Named at last', createdAt: '2026-09-01' };\n");
  });

  it('writes a meta export when the file has none, below the imports', () => {
    const source = "import { SIZES } from '@open-frame/core';\n\nexport default [];\n";
    const out = setMetaTitle(source, 'First name');
    expect(out).toBe(
      "import { SIZES } from '@open-frame/core';\n\n" +
        "export const meta = { title: 'First name' };\n\nexport default [];\n",
    );
  });

  it('reports a file it cannot parse instead of mangling it', () => {
    expect(setMetaTitle('export const meta = {', 'Nope')).toBeNull();
  });
});

describe('duplicating', () => {
  it('takes the next free copy id', () => {
    expect(nextCopyId('onboarding', [])).toBe('onboarding-copy');
    expect(nextCopyId('onboarding', ['onboarding-copy'])).toBe('onboarding-copy-2');
    expect(nextCopyId('onboarding', ['onboarding-copy', 'onboarding-copy-2'])).toBe(
      'onboarding-copy-3',
    );
  });
});
