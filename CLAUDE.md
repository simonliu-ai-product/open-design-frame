# open-design-frame — Framework Repo Guide

You are working on the **open-design-frame framework** — the runtime, Vite plugins, and CLI.

open-design-frame is to design artboards what open-doc is to documents and open-slide is
to decks: the work is written as React components, and the viewer is a canvas
rather than a page or a projector.

## Layout

pnpm + Turbo monorepo.

| Path | Package | Role |
| --- | --- | --- |
| `packages/core` | `@open-design-frame/core` | Runtime (canvas, frame rail, inspector, assets), Vite plugins, `open-design-frame` dev/build CLI. |
| `packages/mcp` | `@open-design-frame/mcp` | MCP server over the same ops. Opt-in: `open-design-frame dev --mcp`. |
| `apps/demo` | private | Local consumer via `workspace:*`. Dogfood target — `pnpm dev`. |

## Workflow

```bash
pnpm dev          # turbo: runs the demo against local core
pnpm build        # build all packages
pnpm typecheck    # tsc across the graph
pnpm check        # biome (format + lint)
pnpm check:fix    # auto-fix what biome can
pnpm test         # vitest
```

**After changing `packages/core/src`, rebuild it (`pnpm --filter @open-design-frame/core build`)
before testing the demo** — the demo's `open-design-frame` binary runs the built `dist`.

## What a frame is

`frames/<id>/index.tsx` default-exports an array of frames. A frame is a
component that carries its own size:

```tsx
const Dashboard: Frame = () => <div>…</div>;
Dashboard.frameName = 'Dashboard · Desktop';
Dashboard.size = SIZES.DESKTOP;
export default [Dashboard];
```

`meta` names the file, `design` supplies the tokens (`--odf-*`). Wrapping a part
of the frame in `<Layer name="…">` is what puts it in the inspector's tree —
unwrapped markup still renders, it just cannot be selected.

## Architecture notes

- **The size travels with the frame, not the project.** open-doc fixes A4 and
  open-slide fixes 16:9 because the medium decides; a design has no medium, so
  `Frame.size` is per-frame and `SIZES` only names the common ones.
- **One renderer for three surfaces.** The home cover, the rail thumbnail and
  the canvas are all `FrameCanvas` at different scales — a thumbnail that
  disagrees with what opens is not a state this can reach. The canvas scales the
  container, never the contents, so every length inside a frame is the length
  that will be exported.
- **A fitted canvas measures its own box.** `FrameCanvas` without `scale` reads
  its container with a ResizeObserver, so the container must have a size of its
  own — a scrollable parent using `place-items: center` grows to fit the frame,
  and the fit then reads that larger number and never shrinks.
- **The layer tree is read from the DOM, not the source.** A frame is ordinary
  JSX — helpers, `map`, conditionals — so the component tree and the picture
  disagree the moment anything is generated. `collectLayers` walks rendered
  `[data-odf-layer]` elements, and the effect that runs it depends on the loaded
  module: keyed only by the frame id it runs once against a null ref.
- **One implementation, two callers.** Everything that touches the workspace
  lives in `src/ops` and raises `OpsError` rather than writing status codes.
  The dev server's routes turn that into HTTP; the MCP tools turn it into a
  tool error. A second implementation of "rename a frame" would drift the first
  time one of them learned something the other did not.
- **A write carries the revision it read.** `write_frame` hashes the source it
  is replacing and refuses a stale one, because the other half of this
  workspace is a person with the file open.
- **Picking happens on the canvas.** Most of a frame is never wrapped in a
  named `Layer`, and the thing a designer is looking at is the thing they point
  at — so the click handler takes the innermost element carrying a source tag,
  and the layer list is a second way in, not the only one. A frame's own links
  and buttons do not follow on click; this is a canvas, not a preview.
- **A selection is a description, not a reference.** An edit reloads the module
  and every element in the frame becomes a new object, so `Pick` records the
  layer id, else the source location plus which of that site's renders it was —
  a held node would go stale exactly when the panel is meant to show the result.
- **An edit previews itself.** Changing a value writes the element's own inline
  style, which is what the save will write into the source, so what the canvas
  shows between the change and the save is the result rather than a guess at it.
  Discard reloads: undoing a preview by hand would be a second implementation of
  the same thing, and the source is already the answer.
- **The inspector edits source, not the DOM.** `loc-tags-plugin` stamps
  `data-odf-loc="line:col"` onto host JSX in `frames/**` (dev only); the panel
  posts ops to `/__edit`, and `editing/edit-ops.ts` rewrites the file with
  Babel. Edits are staged until saved — a write and an HMR reload behind each
  digit of a font size is not an edit, it is a stutter.
- **`Layer` forwards its loc tag.** Capitalised JSX is normally skipped because
  a component's location is its call site, but `Layer` renders one host element
  and nothing else, so the call site *is* where that element is written. Without
  the forward, selecting a named layer edits whatever ancestor happened to carry
  a tag.
- **A shared style object is refused, not rewritten.** `style={CARD}` is one
  value many elements use; changing it would restyle all of them, which is not
  what dragging one slider means.
- **`LOC_ATTR` lives in `editing/loc.ts`, alone.** Both the plugin and the viewer
  need it, and they cannot share a file: the plugin imports Babel, and pulling
  that into the browser bundle breaks the page — Babel reaches for `process`.
- **The viewer ships as source.** `files` includes `src/app`, and the user's own
  Vite compiles it alongside their frames. Shipping it built would put two
  Reacts in one page.
- **A prototype's links live in the frame.** `<Layer to="Cards · Desktop">`
  names where a press goes; the player follows it and nothing else. Pressing
  somewhere with no link flashes the ones there are, because a prototype that
  swallows a press teaches the wrong thing about the design. The player draws
  the same component the canvas does — a second renderer would be a second
  design — and wraps it in a browser or a phone by the frame's own width.
- **A theme is tokens plus a document.** The tokens are what the frames read;
  `DESIGN.md` is what a person or an agent reads before deciding something the
  tokens do not cover. It sits beside them so the two go stale together or not
  at all, and it is bundled into the build rather than fetched — a design system
  nobody can read once it ships is not one.
- **The theme sheet is generated, not drawn.** Every swatch, specimen and
  control on it comes from the theme's own tokens, so it cannot promise
  something the frames will not do. The ramps are the colour mixed toward black
  and white, and say so — a theme that wants eleven greys declares eleven greys.
- **An export is a folder, so it is a zip.** A design goes to whoever asked for
  it as a set of files; four separate downloads to name and sort by hand is not
  that. Every frame is drawn on an off-screen stage at its own size rather than
  from the canvas, because only one frame is ever on the canvas and it is
  scaled. Off-screen, not `display: none` — an element with no layout
  photographs as nothing.
- **Nothing in the export path waits on an animation frame.** A tab that is not
  being painted gets no frames, and an export that never starts is worse than
  one that refuses; each page also has a timeout that says what to do.
- **A comment is a JSX comment in the frame's own file.** The note and the
  markup it is about then travel together through git, a rename, a branch and a
  review, and a note whose element was deleted goes with it rather than pointing
  at a line that now says something else. It is written on its own line where
  the element's children start on one and inline where they do not, so removing
  it takes back exactly what was added.
- **A folder is a label, not a directory.** `frames/.folders.json` holds the
  folders and which frame is in which. Moving a frame between folders must not
  move its file: the folder name is the id, and the id is in the URL, in the
  asset paths beside it and in whatever links to it. Renaming a frame writes
  `meta.title` for the same reason; duplicating and deleting do move folders.
- **Assets have two scopes and nothing is copied between them.** A picture used
  by one frame lives in `frames/<id>/assets/`; one used by all of them lives in
  the project's `assets/`. A file in two places is two files to keep in step.

## Hard rules

- **Biome must pass before commit.** Run `pnpm check` (or `pnpm check:fix`).
- Don't add dependencies casually — `core` ships to users.
- **Nothing in the UI may look like a feature it does not have.** A nav row with
  a count that filters nothing, a tab that leads nowhere: delete it or build it.
- **Default to writing no comments.** Only when the WHY is non-obvious — a
  hidden constraint, a subtle invariant, a workaround for a specific bug. Don't
  explain WHAT the code does, don't write section banners, don't leave
  commented-out code.
