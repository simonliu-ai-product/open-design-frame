import { describe, expect, it } from 'vitest';
import { DICTIONARIES, EN, LOCALES, translate } from './i18n.tsx';

describe('i18n dictionaries', () => {
  const enKeys = Object.keys(EN).sort();

  for (const { code } of LOCALES) {
    it(`${code} has the exact same keys as EN and no empty strings`, () => {
      const dict = DICTIONARIES[code];
      expect(Object.keys(dict).sort()).toEqual(enKeys);
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim().length, `${code}:${k} should not be empty`).toBeGreaterThan(0);
      }
    });
  }

  it('interpolates {var} placeholders across locales', () => {
    expect(translate('en', 'inspect.fromConst', { name: 'CARD' })).toBe('from CARD');
    expect(translate('zh-TW', 'inspect.fromConst', { name: 'CARD' })).toBe('來自 CARD');
    expect(translate('ja', 'export.allFrames', { n: 4 })).toBe('全 4 枚');
  });
});
