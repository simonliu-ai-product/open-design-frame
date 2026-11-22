# @open-design-frame/mcp

## 0.3.0

### Minor Changes

- [#4](https://github.com/simonliu-ai-product/open-design-frame/pull/4) [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Check what only a layout shows. A frame that throws now stays on its own artboard with an error card instead of blanking the viewer. `open-design-frame check --render` and `check_frames` with `render: true` draw every frame headlessly (Playwright, an optional peer) and report frames that throw, files that do not load, overflow, broken images and type under 9px. `open-design-frame render <id>` and the `render_frame` MCP tool return a PNG of a frame. `/f/<id>/render` draws a file's frames alone and `window.__openDesignFrame` reports what it found. The MCP server also runs over stdio as `open-design-frame-mcp`.

### Patch Changes

- Updated dependencies [[`c6fef5d`](https://github.com/simonliu-ai-product/open-design-frame/commit/c6fef5db5f9e826461332c4f28f90a7891114d08), [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c), [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c), [`e496552`](https://github.com/simonliu-ai-product/open-design-frame/commit/e496552bcab10479edec15398ab0d1a424700b1c)]:
  - @open-design-frame/core@0.3.0
