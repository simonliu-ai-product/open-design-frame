# @open-design-frame/core

## 0.3.0

### Minor Changes

- [#5](https://github.com/simonliu-ai-product/open-design-frame/pull/5) [`c6fef5d`](https://github.com/simonliu-ai-product/open-design-frame/commit/c6fef5db5f9e826461332c4f28f90a7891114d08) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - An agent beside the canvas: `open-design-frame dev` has a Codex panel (A) that works in the workspace on your own Codex sign-in. A turn knows the file, the artboard on screen and the element picked on the canvas; when it ends, the dev server checks the files it changed (and draws them when Playwright is installed) and offers the findings back to the agent. Conversations stay in `node_modules/.open-design-frame/`. `dev --no-agent` leaves it out, and a host app that declares the open-x `agent` capability hides it.

- [#4](https://github.com/simonliu-ai-product/open-design-frame/pull/4) [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Check what only a layout shows. A frame that throws now stays on its own artboard with an error card instead of blanking the viewer. `open-design-frame check --render` and `check_frames` with `render: true` draw every frame headlessly (Playwright, an optional peer) and report frames that throw, files that do not load, overflow, broken images and type under 9px. `open-design-frame render <id>` and the `render_frame` MCP tool return a PNG of a frame. `/f/<id>/render` draws a file's frames alone and `window.__openDesignFrame` reports what it found. The MCP server also runs over stdio as `open-design-frame-mcp`.

- [#4](https://github.com/simonliu-ai-product/open-design-frame/pull/4) [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - A workspace no longer needs its own install to be served: frames always import the running core and its React, so a host app can serve many workspaces from one shared core (with a normal install that is the same copy). `OPEN_DESIGN_FRAME_CACHE_DIR` gives each workspace its own Vite cache instead of the one beside core.

### Patch Changes

- [#4](https://github.com/simonliu-ai-product/open-design-frame/pull/4) [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - The frame view's top bar fits narrow windows: shortcut hints, then button labels, then view-mode words give way to icons, and the title truncates inside its column instead of covering the controls. Frame names in the rail wrap to two lines, and the inspector starts open only where the canvas has room beside it.
