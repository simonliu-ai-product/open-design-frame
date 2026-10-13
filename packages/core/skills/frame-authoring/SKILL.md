---
name: frame-authoring
description: Technical reference for authoring frames/<id>/index.tsx, Layer components, SIZES, themes, and prototype links in open-design-frame.
---

# Frame Authoring Reference (`/frame-authoring`)

## File Contract (`frames/<id>/index.tsx`)

```tsx
import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';
import aurora from '../../themes/aurora';

export const meta: FrameMeta = {
  title: 'Welcome',
  createdAt: '2026-10-13',
};
export const design = aurora;

const Desktop: Frame = () => (
  <Layer name="Hero" style={{ width: '100%', height: '100%', padding: 72 }}>
    <Layer name="Headline" kind="text" as="h1" style={{ fontSize: 'var(--odf-size-hero)' }}>
      Start where the warmth is.
    </Layer>
    <Layer name="MobileCTA" to="Welcome · Mobile" style={{ marginTop: 24 }}>
      Open Mobile View →
    </Layer>
  </Layer>
);

Desktop.frameName = 'Welcome · Desktop';
Desktop.size = SIZES.DESKTOP;

export default [Desktop];
```

## Rules & Tokens

- **Sizes (`SIZES`)**:
  - `SIZES.DESKTOP`: `{ width: 1440, height: 1024 }`
  - `SIZES.LAPTOP`: `{ width: 1280, height: 800 }`
  - `SIZES.TABLET`: `{ width: 834, height: 1194 }`
  - `SIZES.PHONE`: `{ width: 390, height: 844 }`
  - `SIZES.WIDE`: `{ width: 1600, height: 900 }`
  - `SIZES.SQUARE`: `{ width: 1080, height: 1080 }`
  - Or any custom `{ width: number, height: number }`.
- **Theme CSS Variables (`--odf-*`)**:
  - Palette: `var(--odf-bg)`, `var(--odf-surface)`, `var(--odf-ink)`, `var(--odf-muted)`, `var(--odf-border)`, `var(--odf-accent)`, `var(--odf-accent-ink)`
  - Fonts: `var(--odf-font-display)`, `var(--odf-font-sans)`, `var(--odf-font-mono)`
  - Type scale: `var(--odf-size-hero)`, `var(--odf-size-h1)`, `var(--odf-size-h2)`, `var(--odf-size-h3)`, `var(--odf-size-lead)`, `var(--odf-size-body)`, `var(--odf-size-caption)`
- **Prototype Navigation**:
  - `<Layer name="..." to="Target Frame Name">` links to another frame in the same file whose `Component.frameName` matches `to`.
- **Shared Styles**:
  - Shared style objects (`const CARD = { ... }`) are supported; when edited in the Inspector, overrides are spread (`style={{ ...CARD, padding: 32 }}`).
