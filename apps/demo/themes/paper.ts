import type { DesignSystem, ThemeMeta } from '@open-frame/core';

export const meta: ThemeMeta = {
  name: 'Paper',
  description: 'Light editorial surface — warm white, serif display, hairline rules, ink accent.',
};

const paper: DesignSystem = {
  palette: {
    bg: '#fbfaf7',
    text: '#16150f',
    accent: '#1b4dd8',
    muted: '#6d6a5e',
    surface: '#f2f0ea',
    line: '#e2dfd5',
  },
  fonts: {
    display: 'ui-serif, Georgia, "Times New Roman", serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  typeScale: { hero: 56, title: 24, body: 15, caption: 12 },
  radius: 6,
};

export default paper;
