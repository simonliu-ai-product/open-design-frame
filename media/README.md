# media

`intro.mp4` — 30.000s, 1440×900, 30fps.

| | |
| --- | --- |
| 0:00 | Title card |
| 0:03 | An agent creates a frame over MCP; the card appears on the home page |
| 0:10 | The canvas: click an element, drag the size, save it into the source |
| 0:17 | Play: the simulated browser, following the frame's own links |
| 0:22 | A theme: the sheet, then its DESIGN.md |
| 0:27 | Closing card |

Nothing in it is staged. The frame in the first act is created live over the MCP
endpoint while the recording runs, and every click after that is a real click on
the running dev server. The cursor, captions, cuts and both cards are elements
injected into the page, so what was recorded is what was on screen — there is no
post-production pass.

## Remaking it

```bash
open-design-frame dev --mcp                      # apps/demo, on :5274
pnpm add -D playwright                    # in a scratch folder, beside this script
node record-intro.mjs                     # writes video/*.webm (~30s)
ffmpeg -i video/*.webm \
  -vf "tpad=stop_mode=clone:stop_duration=1.5,fps=30,format=yuv420p" \
  -t 30 -c:v libx264 -crf 18 -preset slow -movflags +faststart intro.mp4
```

`intro-frame.tsx` is the source the agent writes in act one; the script deletes
that frame at the start of a take so the take can create it again.

The play and theme beats point at frames that are not in this repository — the
recording was made against a fuller local workspace. Point those two steps at
whatever frames you have before running it again.

Playwright is not a dependency of this repo — the video is made once in a while,
and a recording tool has no business in what ships.
