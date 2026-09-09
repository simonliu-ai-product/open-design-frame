import type { DesignSystem, ThemeMeta } from '@open-design-frame/core';

export const meta: ThemeMeta = {
  name: 'Ember',
  description: 'Warm dark onboarding surface — plum ground, serif display, an orange call to act.',
};

const ember: DesignSystem = {
  palette: {
    bg: '#0f0d12',
    text: '#f6f4f8',
    accent: '#ff7a4d',
    muted: '#98929e',
    surface: '#191620',
    line: '#2a2531',
  },
  fonts: {
    display: 'ui-serif, Georgia, "Times New Roman", serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 52, title: 22, body: 14, caption: 12 },
  radius: 16,
};

export default ember;
