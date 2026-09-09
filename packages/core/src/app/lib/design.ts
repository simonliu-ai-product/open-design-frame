export type DesignPalette = {
  bg: string;
  text: string;
  accent: string;
  muted?: string;
  surface?: string;
  line?: string;
};

export type DesignFonts = { display: string; body: string; mono?: string };

export type DesignTypeScale = { hero?: number; title?: number; body?: number; caption?: number };

export type DesignSystem = {
  palette: DesignPalette;
  fonts: DesignFonts;
  typeScale?: DesignTypeScale;
  radius?: number;
};

export const defaultDesign: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#101014',
    accent: '#7c5cff',
    muted: '#6b6b76',
    surface: '#f6f6f8',
    line: '#e6e6ec',
  },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  typeScale: { hero: 64, title: 28, body: 15, caption: 12 },
  radius: 12,
};

/**
 * Tokens become CSS variables so a frame styles itself the same way whether it
 * is drawn on the canvas, in a thumbnail, or into an export — one declaration
 * site, three renderers.
 */
export function designToCssVars(design: DesignSystem): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(design.palette)) {
    if (value !== undefined) vars[`--odf-${key}`] = value;
  }
  for (const [key, value] of Object.entries(design.fonts)) {
    if (value !== undefined) vars[`--odf-font-${key}`] = value;
  }
  for (const [key, value] of Object.entries(design.typeScale ?? {})) {
    if (value !== undefined) vars[`--odf-size-${key}`] = `${value}px`;
  }
  if (design.radius !== undefined) vars['--odf-radius'] = `${design.radius}px`;
  return vars;
}

export function mergeDesign(design?: DesignSystem): DesignSystem {
  if (!design) return defaultDesign;
  return {
    palette: { ...defaultDesign.palette, ...design.palette },
    fonts: { ...defaultDesign.fonts, ...design.fonts },
    typeScale: { ...defaultDesign.typeScale, ...design.typeScale },
    radius: design.radius ?? defaultDesign.radius,
  };
}
