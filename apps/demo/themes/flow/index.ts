import type { DesignSystem, ThemeMeta } from '@open-design-frame/core';

export const meta: ThemeMeta = {
  name: 'Flow',
  description: 'Light product surface — grey canvas, white cards, one violet accent, tight type.',
};

const flow: DesignSystem = {
  palette: {
    bg: '#e9eaee',
    text: '#16161a',
    accent: '#7c5cff',
    muted: '#6b6b76',
    surface: '#ffffff',
    line: '#e6e6ec',
  },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  typeScale: { hero: 34, title: 20, body: 13, caption: 11 },
  radius: 14,
};

export default flow;
