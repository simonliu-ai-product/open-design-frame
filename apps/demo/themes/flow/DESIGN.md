# Flow

## 1. Visual theme & atmosphere

A light product surface for dense, everyday screens — dashboards, tables,
settings. Grey canvas, white cards, one violet accent, type kept small and
tight so more fits without shouting. It should feel like a well-kept ledger:
quiet, orderly, nothing decorative.

## 2. Color palette

| Token | Value | Use |
| --- | --- | --- |
| `--odf-bg` | `#E9EAEE` | The canvas behind the cards. |
| `--odf-surface` | `#FFFFFF` | Every card, panel and table. |
| `--odf-line` | `#E6E6EC` | 1px borders and row rules. |
| `--odf-text` | `#16161A` | Figures and headings. |
| `--odf-muted` | `#6B6B76` | Labels, units, timestamps. |
| `--odf-accent` | `#7C5CFF` | Charts, the selected nav row, one button. |

Tints: success `#1F8A53` and danger `#B4232A`, each on a 10% wash of itself.
A positive figure is not green by default — only a delta is.

## 3. Typography

- Display and body: `-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif`
- Mono: `ui-monospace, SFMono-Regular, Menlo, monospace`

| Step | Size | Line height | Tracking |
| --- | --- | --- | --- |
| hero | 34px | 1.15 | −0.025em |
| title | 20px | 1.3 | −0.01em |
| body | 13px | 1.55 | 0 |
| caption | 11px | 1.45 | 0.08em, uppercase for column heads |

Figures use `font-variant-numeric: tabular-nums`, always. A column of numbers
that does not line up is a bug.

## 4. Spacing and layout

- Base unit 2px, stepping 6, 10, 14, 18, 26.
- Card padding 18px; grid gap 14px; page padding 26px.
- Sidebar 214px, fixed. Table rows 11px vertical padding with a 1px top rule.

## 5. Component styles

- Corner radius 14px (`--odf-radius`); chips and pills 999px; inputs 9px.
- Cards: `--odf-surface` with a 1px `--odf-line` border, never a shadow.
- Stat cards may take a 10% tint of a semantic colour as their whole background.
- Nav row, selected: 10% accent wash, `--odf-text`, 9px radius.

## 6. Elevation & motion

- Flat. The only depth is the border between a card and the canvas.
- Hover changes background by one step; nothing moves.

## 7. Responsive behaviour

Drawn at 1440×1024 and 390×844. On the phone the sidebar becomes a bottom tab
bar of four items and every grid collapses to one column.

## 8. Do's and don'ts

- Do use tabular figures for anything numeric.
- Do keep the accent for data and one action; a page of violet is a chart nobody
  can read.
- Don't put a shadow under a card.
- Don't use the hero size below 1280px wide.
- Don't colour a whole row to mean something; colour the delta.

## 9. Agent prompt guide

> Build this in the Flow theme: `--odf-bg` canvas, `--odf-surface` cards with a
> 1px `--odf-line` border, 14px radius, 18px padding, 14px gaps, no shadows.
> Body 13px, column heads 11px uppercase `--odf-muted` at 0.08em. All figures
> tabular. The accent appears in charts and on one action only.
