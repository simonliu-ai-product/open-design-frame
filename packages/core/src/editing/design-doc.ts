import type { DesignSystem } from '../app/lib/design.ts';

/**
 * A DESIGN.md the way the convention describes it, with the half we already
 * know filled in.
 *
 * The tokens are not a guess — they are read off the theme, so the colour and
 * type sections are true the moment the file exists. The prose sections are
 * left as questions, because an atmosphere nobody wrote down is not something
 * a generator can invent for them.
 */
export function starterDesignDoc(name: string, design: DesignSystem): string {
  const { palette, fonts, typeScale, radius } = design;
  const row = (label: string, value: string | undefined) =>
    value === undefined ? null : `| ${label} | \`${value}\` |`;

  const colours = [
    row('Background', palette.bg),
    row('Text', palette.text),
    row('Accent', palette.accent),
    row('Muted', palette.muted),
    row('Surface', palette.surface),
    row('Line', palette.line),
  ]
    .filter((line) => line !== null)
    .join('\n');

  const sizes = Object.entries(typeScale ?? {})
    .map(([key, value]) => `| ${key} | ${value}px |`)
    .join('\n');

  return `# ${name}

## 1. Visual theme & atmosphere

<!-- One paragraph: what this theme feels like, and who it is for. "Warm and
     minimal", "cold and technical", "editorial". Written for whoever has to
     make a decision this file does not cover. -->

## 2. Color palette

| Token | Value |
| --- | --- |
${colours}

Use \`--ofr-accent\` for one thing per screen. Text is \`--ofr-text\` on
\`--ofr-bg\`; secondary text is \`--ofr-muted\`.

## 3. Typography

- Display: \`${fonts.display}\`
- Body: \`${fonts.body}\`${fonts.mono ? `\n- Mono: \`${fonts.mono}\`` : ''}

| Step | Size |
| --- | --- |
${sizes}

## 4. Spacing and layout

<!-- The base unit and the numbers that come off it. -->

## 5. Component styles

- Corner radius: ${radius ?? 0}px (\`--ofr-radius\`)

<!-- Buttons, cards, inputs: borders, padding, states. -->

## 6. Elevation & motion

<!-- Which shadow at which level, and how long a transition lasts. -->

## 7. Responsive behaviour

<!-- Which frame sizes this theme is drawn at, and what changes between them. -->

## 8. Do's and don'ts

- Do use the tokens above rather than literal colours.
- Don't introduce a second accent.

## 9. Agent prompt guide

<!-- A sentence an agent can be handed to build a component in this theme. -->
`;
}
