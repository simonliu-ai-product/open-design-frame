---
"@open-design-frame/core": minor
"@open-design-frame/mcp": minor
---

Check what only a layout shows. A frame that throws now stays on its own artboard with an error card instead of blanking the viewer. `open-design-frame check --render` and `check_frames` with `render: true` draw every frame headlessly (Playwright, an optional peer) and report frames that throw, files that do not load, overflow, broken images and type under 9px. `open-design-frame render <id>` and the `render_frame` MCP tool return a PNG of a frame. `/f/<id>/render` draws a file's frames alone and `window.__openDesignFrame` reports what it found. The MCP server also runs over stdio as `open-design-frame-mcp`.
