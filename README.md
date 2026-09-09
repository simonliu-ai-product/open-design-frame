# open-frame

**Design frames, written as components.**

A frame is a fixed-size artboard — a desktop screen, a phone screen, a poster.
You write it in TSX, the canvas shows it at true size, and the inspector edits
it by rewriting the file you wrote.

The third of a family: [open-doc](https://github.com/simonliu-ai-product/open-doc)
is documents, open-slide is decks, open-frame is design surfaces.

https://github.com/simonliu-ai-product/open-frame — 30 seconds of it working:
[`media/intro.mp4`](media/intro.mp4).

## Getting started

```bash
pnpm install
pnpm dev          # canvas at http://localhost:5274
```

`/` lists every frame file. Click one to open the canvas.

## Writing a frame

`frames/<id>/index.tsx` default-exports an array of frames:

```tsx
import { type Frame, Layer, SIZES } from '@open-frame/core';

const Welcome: Frame = () => (
  <Layer name="Hero" style={{ padding: 72 }}>
    <Layer name="Headline" kind="text" as="span" style={{ fontSize: 52 }}>
      Start where the warmth is.
    </Layer>
  </Layer>
);

Welcome.frameName = 'Welcome · Desktop';
Welcome.size = SIZES.DESKTOP;

export default [Welcome];
```

- **`size`** travels with the frame. `SIZES` names the common ones
  (`DESKTOP`, `LAPTOP`, `TABLET`, `PHONE`, `SQUARE`); any `{ width, height }`
  works.
- **`design`** exports the tokens the frame styles itself with — they become
  `--ofr-*` CSS variables.
- **`<Layer name="…">`** is what puts a piece of the frame in the inspector.
  Unwrapped markup renders the same, it just cannot be selected.

## Inspect

Click anything on the canvas. The panel shows what the browser actually
resolved — typography, colour, box — and changing a value applies it to the
canvas at once and **stages** it; Save writes it into `frames/<id>/index.tsx`,
Discard reloads what the file says.

The layer list is a second way to select: `<Layer name="…">` names a piece of
the frame, but an unnamed element is just as selectable by pointing at it.

It edits the element's own `style` object. An element that takes its style from
a shared constant is refused with the reason rather than rewritten, because
changing that constant would restyle everything else using it.

## Play

**Play** (`P`) opens the frame at size, inside a simulated browser — or a phone,
for a narrow frame. Presses follow the links the frame declares:

```tsx
<Layer name="Transactions" to="Transactions · Desktop">…</Layer>
```

`to` names a frame by its `frameName`, its `url`, or its number. A press with
nowhere to go flashes the hotspots instead; `H` pins them on. `Frame.url` is
what the address bar reads.

## Comments

The bubble in the corner of the canvas holds the notes on the frame. A note is
attached to whatever is selected and written into the frame's source as a JSX
comment beside that element — so it survives a reload, travels in the commit,
and is readable by whoever opens the file next.

## Themes

`themes/<id>.ts` default-exports a `DesignSystem`; a frame uses one with
`export const design = aurora`. A theme that has more to say lives in a folder:

```
themes/aurora/
  index.ts      the tokens
  DESIGN.md     the half tokens cannot hold
```

Click a theme to open it, and take its document with the copy button. The sheet at the top is drawn entirely from that
theme's tokens — colour ramps, type specimens, the controls it would paint —
so it cannot show something the frames will not do. Below it is the
[DESIGN.md](https://www.thisweb.dev/articles/design-md): atmosphere, spacing,
component rules, do's and don'ts, and the prompt an agent should be handed. If
there is none yet, open-frame will start one from the tokens it already knows.

## Folders

The home page groups frames into folders, kept in `frames/.folders.json`. A
folder is a label: moving a frame between them changes nothing on disk. The ⋯
on a card renames the frame (its `meta.title`), duplicates its folder, moves it
between folders, or deletes it.

## Export

The Export panel writes **one zip**, with a folder per format:

```
flow-web.zip
  html/01-overview-desktop.html
  png/01-overview-desktop.png
  svg/01-overview-desktop.svg
```

Choose the pages (this frame, or all of them) and the formats. PNG takes the
scale — 1×, 2× or 3× of the frame's declared size; HTML and SVG have no pixels
to multiply. The HTML is a page that opens on its own: the markup plus the
design tokens, no stylesheet to ship beside it.

Every frame is drawn at its own size for the capture, so the zoom you happen to
be viewing at never reaches the file. Edits you have staged but not saved are
not in the export — the panel says so when there are any.

## Assets

`Assets` lists the files a frame draws with, in two scopes: `frames/<id>/assets/`
for one frame, and the project's `assets/` for all of them. Drop files on the
page or use Upload; **Copy path** gives you the import to paste.

## For agents

```bash
pnpm add -D @open-frame/mcp
pnpm dev --mcp        # canvas at :5274, MCP endpoint at :5274/mcp
```

23 tools over stateless Streamable HTTP: the frames, one element at a time, the
comments, the folders, the themes and the assets. They call the same functions
the dev server calls, so an agent and a person edit one workspace — including
the conflict check that refuses a write against source somebody else changed.

## Getting around

`⌘K` (or the search icon) jumps to any frame, theme or folder by name. The moon
switches the viewer's own chrome between dark and light — a frame is unaffected,
because a dark design has to look the same whichever desk it is read at.

## Layout

| | |
| --- | --- |
| [`packages/core`](packages/core) | the published runtime, Vite plugins and CLI |
| [`packages/mcp`](packages/mcp) | the MCP server, for agents |
| [`apps/demo`](apps/demo) | a project that uses it |

## License

MIT
