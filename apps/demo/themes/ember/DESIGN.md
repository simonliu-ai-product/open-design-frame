# Ember

## 1. Visual theme & atmosphere

A warm dark surface for the first five minutes of a product — onboarding,
welcome, a single decision per screen. Plum-black ground, a serif display face,
and one orange that only ever marks the thing you should press next. It should
read as evening rather than night: warm, unhurried, a little editorial.

## 2. Color palette

| Token | Value | Use |
| --- | --- | --- |
| `--odf-bg` | `#0F0D12` | The page. |
| `--odf-surface` | `#191620` | Cards and inset panels. |
| `--odf-line` | `#2A2531` | Hairlines, 1px, and the outline button. |
| `--odf-text` | `#F6F4F8` | Headings and body. |
| `--odf-muted` | `#98929E` | Supporting copy, captions, inactive steps. |
| `--odf-accent` | `#FF7A4D` | The one action on the screen. |

The accent is warm enough to carry `--odf-bg` as its text colour; never put
`--odf-text` on it.

## 3. Typography

- Display: `ui-serif, Georgia, "Times New Roman", serif`
- Body: `-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif`

| Step | Size | Line height | Tracking |
| --- | --- | --- | --- |
| hero | 52px | 1.08 | −0.02em |
| title | 22px | 1.25 | −0.01em |
| body | 14px | 1.65 | 0 |
| caption | 12px | 1.5 | 0.22em, uppercase |

The serif is for the hero only. A serif at body size on this ground goes muddy.

## 4. Spacing and layout

- Base unit 4px. Use 4, 8, 14, 22, 34, 56, 72.
- Screen padding 72px on desktop, 20px on a phone.
- One column of content, max 34rem wide, left-aligned. Never centre body copy.

## 5. Component styles

- Corner radius 16px (`--odf-radius`); the primary button is a 999px pill.
- Primary: `--odf-accent` fill, `--odf-bg` text, 12px/22px padding.
- Secondary: 1px `--odf-line` border on nothing, `--odf-text`.
- Progress dots: 7px, the current one stretched to 22px in `--odf-accent`.

## 6. Elevation & motion

- One shadow only, on the hero image: `0 30px 70px rgba(0,0,0,0.55)`.
- Transitions 180ms `ease-out`. A step change may fade, never slide.

## 7. Responsive behaviour

Drawn at 1280×800 and 390×844. On the phone the two-column split becomes one
column and the illustration moves below the copy.

## 8. Do's and don'ts

- Do leave the lower third of the screen empty; the whitespace is the mood.
- Do keep to one action per screen, one accent per screen.
- Don't use the serif below 22px.
- Don't put `--odf-text` on the accent.
- Don't add a second illustration to balance the layout.

## 9. Agent prompt guide

> Build this in the Ember theme: `--odf-bg` page, 72px padding, a single left
> column no wider than 34rem. Hero in the serif at 52px/1.08, body 14px/1.65 in
> `--odf-muted`. Exactly one `--odf-accent` pill button with `--odf-bg` text.
> Leave the bottom third empty. No serif under 22px.
