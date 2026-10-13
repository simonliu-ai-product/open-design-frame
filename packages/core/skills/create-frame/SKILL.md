---
name: create-frame
description: Draft a new design frame or multi-screen prototype in frames/<id>/index.tsx from natural language.
---

# Create a Frame (`/create-frame`)

Follow this workflow when asked to create a new design, UI screen, prototype, or poster in `open-design-frame`:

1. **Read the workspace themes first**:
   - Check `themes/` (`themes/<id>.ts` and `themes/<id>.DESIGN.md`) so the frame uses an existing `DesignSystem` and follows its visual rules.
   - Read the `frame-authoring` skill for the exact file contract and `--odf-*` CSS tokens.
2. **Clarify scope before writing**:
   - Confirm the target surfaces (`SIZES.DESKTOP` 1440×1024, `SIZES.LAPTOP` 1280×800, `SIZES.TABLET` 834×1194, `SIZES.PHONE` 390×844, `SIZES.SQUARE` 1080×1080, or custom `{ width, height }`).
   - Confirm whether screens should link together in Play mode (`<Layer name="..." to="Target · Desktop">`).
3. **Scaffold or write `frames/<id>/index.tsx`**:
   - Or start from a template with `open-design-frame new <id> --template <landing-page|mobile-app|dashboard-ui|social-poster|blank>`.
   - Wrap major semantic sections and interactive elements in `<Layer name="...">` so they appear in the layer tree.
4. **Verify with `open-design-frame check`**:
   - Always run `npx open-design-frame check <id>` before finishing to verify syntax, `<Layer to="...">` prototype links, and asset paths.
