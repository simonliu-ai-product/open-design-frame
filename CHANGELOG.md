# Changelog

## 0.2.0

- **Shared style constants can be overridden inline.** Selecting an element
  styled with `style={CARD}` or `style={{ ...CARD, ... }}` now shows a
  `from CARD` origin badge in the inspector and rewrites edits as inline spread
  overrides (`style={{ ...CARD, padding: 32 }}`) instead of refusing them, so
  one element can diverge without touching the shared constant.
- **Clickable design token swatches and live DOM diagnostics.** Theme tokens in
  the inspector apply `--odf-*` variables directly to the selected element, and
  a new **Checks** tab reports clipped text, off-artboard elements, and empty
  layers in real time.
- **Changes (`git diff`) panel and canvas overlays.** In dev mode, a **Changes**
  dock (`D`) diffs the active frame against `HEAD` or any recent commit,
  highlights modified elements on the canvas with `Δ` badges, and lets you
  revert individual hunks in place.
- **Canvas comment pins and click-to-comment picking.** Comments pinned to a
  source line render numbered `#1`, `#2` markers directly on the canvas; clicking
  **＋ New comment** enters crosshair picking mode to drop a comment on any
  element.
- **Multi-frame view modes.** Frames with multiple artboards can be viewed in
  **Single**, **Split** (two artboards side-by-side with independent pickers),
  or **Storyboard Grid** mode.
- **Five-locale UI and global Command Palette (`⌘K`).** Full UI localisation for
  English, 繁體中文, 简体中文, 日本語, and 한국어, plus a global `⌘K` palette
  that jumps to frames, artboards, themes, and folders or triggers view, dock,
  theme, and language actions.
- **Agent CLI, templates, skills, and 7 new MCP tools.** Added
  `open-design-frame init`, `preview`, `templates`, `new`, `check`, `diff`, and
  `sync-skills`, 5 built-in starter templates (`blank`, `landing-page`,
  `mobile-app`, `dashboard-ui`, `social-poster`), 4 canonical agent skills,
  active selection tracking (`/__current`), and 7 new MCP tools (`current_frame`,
  `list_templates`, `create_from_template`, `check_frames`, `read_changes`,
  `list_revisions`, `revert_change` — 32 tools in total).

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
