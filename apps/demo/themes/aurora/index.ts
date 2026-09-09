import type { DesignSystem, ThemeMeta } from '@open-frame/core';

export const meta: ThemeMeta = {
  name: 'Aurora',
  description:
    'Dark product surface — near-black canvas, one violet accent, generous type and soft lines.',
};

const aurora: DesignSystem = {
  palette: {
    bg: '#0b0b10',
    text: '#f4f4f7',
    accent: '#8b6cff',
    muted: '#8b8b98',
    surface: '#15151d',
    line: '#24242f',
  },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  typeScale: { hero: 60, title: 26, body: 15, caption: 12 },
  radius: 14,
};

export default aurora;
