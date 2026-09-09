# Changelog

## 0.1.0

First release.

- **Frames as components.** `frames/<id>/index.tsx` default-exports an array of
  components that carry their own size; the canvas draws them at that size and
  scales the container, never the contents.
- **An inspector that edits source.** Click anything on the canvas; changing a
  value applies it at once and stages it, and Save rewrites the frame's own TSX.
  An element styled from a shared constant is refused with the reason.
- **Play.** `<Layer to="…">` declares where a press goes; the player follows
  those links inside a simulated browser or phone, and flashes the hotspots when
  a press has nowhere to go.
- **Export.** One zip, a folder per format — HTML that opens on its own, PNG at
  1×/2×/3×, SVG.
- **Comments.** Notes written into the frame's own source as JSX comments,
  beside the element they are about.
- **Themes.** A design system in `themes/<id>`, with a generated sheet and a
  `DESIGN.md` beside the tokens.
- **Folders and assets.** Folders are labels, not directories; assets have two
  scopes and report which frames use them.
- **MCP.** `open-design-frame dev --mcp` mounts 25 tools on the dev server, over the
  same operations the browser uses, including a revision check that refuses a
  stale write.
