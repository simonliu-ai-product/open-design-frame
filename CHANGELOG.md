# Changelog

## 0.1.1

- **`dev` works from an installed package.** Vite finds what to pre-bundle by
  crawling source from the root and never crawls `node_modules`. In this repo
  the viewer's root is `packages/core/src/app` and the crawl reached it; from a
  real install the same files sit under `node_modules/…/core/src/app`, the
  crawl skipped them, and `react-router-dom` was served unbundled — its
  CommonJS `cookie` dependency failed a named import and the page was blank
  before React mounted. `optimizeDeps` now names the entry and the deps, so
  both layouts behave the same. `build` was never affected, which is why CI did
  not catch it; the packaged job now opens the dev server and checks the viewer
  mounts.
- **Play scrolls a tall frame instead of shrinking it.** A 1440×3800 page was
  being fitted whole into the stage and arrived as an unreadable ribbon. Width
  now decides the scale and height decides how much of the page is in view: the
  shell is sized like a window, the frame keeps its own height inside it, and
  the page scrolls. A phone's window is capped so it does not grow with the
  display. Following a link lands at the top of the page it goes to.

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
