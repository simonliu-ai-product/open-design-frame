# Paper

## 1. Visual theme & atmosphere

A light editorial surface for things meant to be read — long copy, reports,
release notes. Warm white stock, a serif display face, hairline rules instead
of boxes, and an ink blue that behaves like a printer's second colour. It
should feel like a well-set page, not an app.

## 2. Color palette

| Token | Value | Use |
| --- | --- | --- |
| `--ofr-bg` | `#FBFAF7` | The stock. Warm, never pure white. |
| `--ofr-surface` | `#F2F0EA` | A pulled quote, a note, a table header. |
| `--ofr-line` | `#E2DFD5` | Hairline rules, 1px. This theme rules, it does not box. |
| `--ofr-text` | `#16150F` | Body. Warm black, never `#000000`. |
| `--ofr-muted` | `#6D6A5E` | Captions, folios, footnotes. |
| `--ofr-accent` | `#1B4DD8` | Links and one call to action per page. |

## 3. Typography

- Display: `ui-serif, Georgia, "Times New Roman", serif`
- Body: `-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif`
- Mono: `ui-monospace, SFMono-Regular, Menlo, monospace`

| Step | Size | Line height | Tracking |
| --- | --- | --- | --- |
| hero | 56px | 1.06 | −0.02em |
| title | 24px | 1.3 | −0.01em |
| body | 15px | 1.75 | 0 |
| caption | 12px | 1.5 | 0.1em, uppercase |

Body measure 32–36rem. Line height is generous on purpose; do not tighten it to
fit more on the screen.

## 4. Spacing and layout

- Base unit 4px, stepping 8, 16, 24, 40, 64, 96.
- One column, left-aligned, with the folio and captions in the left margin
  where there is room.
- A rule above a section, 40px of air below it.

## 5. Component styles

- Corner radius 6px (`--ofr-radius`) — nearly square, because paper is.
- Links: `--ofr-accent`, underlined at 1px with a 2px offset.
- Buttons: `--ofr-accent` fill with `--ofr-bg` text, 6px radius, no pill.
- Tables: no vertical rules, 1px `--ofr-line` between rows, header in caption
  size and `--ofr-muted`.

## 6. Elevation & motion

- No shadows at all. Depth is a rule or a change of stock.
- Transitions 120ms `ease-out`, on colour only.

## 7. Responsive behaviour

Drawn at 1280×800 and 834×1112. The margin notes fold into the column below
1024px; the measure never exceeds 36rem at any width.

## 8. Do's and don'ts

- Do use rules to separate; do not use cards.
- Do keep the accent for links and one button.
- Don't use pure white or pure black.
- Don't set body copy in the serif; the serif is display only.
- Don't add a shadow to make something look raised — change the stock instead.

## 9. Agent prompt guide

> Build this in the Paper theme: `--ofr-bg` stock, no cards and no shadows —
> separate with 1px `--ofr-line` rules. Display in the serif at 56px/1.06, body
> 15px/1.75 sans on a 34rem measure. Links and one button in `--ofr-accent`,
> 6px radius. No pure black or white.
