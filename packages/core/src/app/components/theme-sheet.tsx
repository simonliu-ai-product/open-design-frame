import type { CSSProperties } from 'react';
import type { DesignSystem } from '../lib/design.ts';

/** #rrggbb → [r, g, b]; anything else is left alone by the caller. */
function rgbOf(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/**
 * A ramp, mixed rather than invented.
 *
 * Each step is the colour itself moved towards black or white by a fixed
 * amount, so the sheet shows what this colour does at other weights without
 * claiming the theme declares eleven of them. A theme that wants its own scale
 * declares the colours it wants.
 */
function ramp(hex: string): string[] {
  const base = rgbOf(hex);
  if (!base) return [hex];
  const steps = [-0.85, -0.68, -0.5, -0.32, -0.15, 0, 0.18, 0.36, 0.54, 0.72, 0.88];
  return steps.map((t) =>
    toHex(base.map((c) => (t < 0 ? c * (1 + t) : c + (255 - c) * t)) as [number, number, number]),
  );
}

/** Black or white on this colour, by Rec. 601 luma — close enough for a swatch. */
const readable = (hex: string): string => {
  const rgb = rgbOf(hex);
  if (!rgb) return '#000';
  const luma = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return luma > 150 ? '#101014' : '#ffffff';
};

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="odf-sheet-colour">
      <div className="odf-sheet-colour-head" style={{ background: value, color: readable(value) }}>
        <b className="odf-sheet-colour-name">{name}</b>
        <code className="odf-sheet-colour-hex">{value.toUpperCase()}</code>
      </div>
      <div className="odf-sheet-ramp">
        {ramp(value).map((step) => (
          <i key={step} style={{ background: step }} title={step} />
        ))}
      </div>
    </div>
  );
}

function Specimen({
  label,
  family,
  size,
  weight,
  cap,
}: {
  label: string;
  family: string;
  size: number;
  weight: number;
  cap: number;
}) {
  return (
    <div className="odf-sheet-card">
      <span className="odf-sheet-card-label">{label}</span>
      <span
        className="odf-sheet-aa"
        style={{ fontFamily: family, fontSize: Math.min(size * 1.6, cap), fontWeight: weight }}
      >
        Aa
      </span>
      <span className="odf-sheet-card-foot">{size}px</span>
    </div>
  );
}

export type ThemeSheetProps = {
  design: DesignSystem;
  /** `card` is the same sheet at the size a gallery cover has room for. */
  variant?: 'full' | 'card';
};

/**
 * What a theme is, on one page.
 *
 * Every colour, letter and control here is drawn from the theme's own tokens —
 * so this sheet cannot say something the frames will not do. It is the picture
 * half of a design system; `DESIGN.md` is the half tokens cannot hold.
 */
export function ThemeSheet({ design, variant = 'full' }: ThemeSheetProps) {
  const { palette, fonts, typeScale, radius } = design;
  const card = variant === 'card';

  const colours = [
    { name: 'Accent', value: palette.accent },
    { name: 'Text', value: palette.text },
    { name: 'Muted', value: palette.muted },
    { name: 'Surface', value: palette.surface },
    { name: 'Background', value: palette.bg },
    { name: 'Line', value: palette.line },
  ]
    .filter((c): c is { name: string; value: string } => typeof c.value === 'string')
    .slice(0, card ? 4 : 6);

  const surface: CSSProperties = {
    background: palette.surface ?? 'rgba(127,127,137,0.12)',
    borderRadius: (radius ?? 12) + 4,
  };
  const pill = (extra: CSSProperties): CSSProperties => ({
    padding: card ? '6px 12px' : '12px 22px',
    borderRadius: 999,
    fontSize: card ? 11 : (typeScale?.body ?? 15),
    fontFamily: fonts.body,
    ...extra,
  });

  if (card) {
    return (
      <div
        className="odf-sheet odf-sheet-mini"
        style={{ background: palette.bg, color: palette.text }}
      >
        <div className="odf-sheet-col">
          {colours.map((c) => (
            <Swatch key={c.name} name={c.name} value={c.value} />
          ))}
        </div>
        <div className="odf-sheet-col">
          <Specimen
            label="Headline"
            family={fonts.display}
            size={typeScale?.hero ?? 56}
            weight={600}
            cap={46}
          />
          <div className="odf-sheet-card" style={surface}>
            <span className="odf-sheet-buttons">
              <span style={pill({ background: palette.accent, color: palette.bg })}>Primary</span>
              <span style={pill({ background: palette.line, color: palette.text })}>Secondary</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="odf-sheet" style={{ background: palette.bg, color: palette.text }}>
      <div className="odf-sheet-col">
        {colours.map((c) => (
          <Swatch key={c.name} name={c.name} value={c.value} />
        ))}
      </div>

      <div className="odf-sheet-col">
        <Specimen
          label="Headline"
          family={fonts.display}
          size={typeScale?.hero ?? 56}
          weight={600}
          cap={96}
        />
        <Specimen
          label="Body"
          family={fonts.body}
          size={typeScale?.title ?? 24}
          weight={400}
          cap={64}
        />
        <Specimen
          label="Label"
          family={fonts.mono ?? fonts.body}
          size={typeScale?.caption ?? 12}
          weight={400}
          cap={34}
        />
      </div>

      <div className="odf-sheet-col">
        <div className="odf-sheet-card" style={surface}>
          <span className="odf-sheet-buttons">
            <span style={pill({ background: palette.accent, color: palette.bg })}>Primary</span>
            <span style={pill({ background: palette.line, color: palette.text })}>Secondary</span>
            <span style={pill({ background: palette.text, color: palette.bg })}>Inverted</span>
            <span style={pill({ border: `1px solid ${palette.accent}`, color: palette.accent })}>
              Outlined
            </span>
          </span>
        </div>

        <div className="odf-sheet-card" style={surface}>
          <span
            className="odf-sheet-field"
            style={{
              background: palette.bg,
              color: palette.muted,
              fontFamily: fonts.body,
              fontSize: typeScale?.body ?? 15,
            }}
          >
            ⌕ Search
          </span>
        </div>

        <div className="odf-sheet-card" style={surface}>
          <span className="odf-sheet-nav" style={{ background: palette.bg }}>
            {['⌂', '⌕', '☺'].map((glyph, i) => (
              <i
                key={glyph}
                style={{
                  background: i === 0 ? palette.accent : 'transparent',
                  color: i === 0 ? palette.bg : palette.muted,
                }}
              >
                {glyph}
              </i>
            ))}
          </span>
        </div>

        <div className="odf-sheet-card" style={surface}>
          <span className="odf-sheet-rules">
            {[1, 0.72, 0.44].map((width, i) => (
              <i
                key={width}
                style={{
                  width: `${width * 100}%`,
                  background: [palette.text, palette.muted, palette.accent][i],
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
