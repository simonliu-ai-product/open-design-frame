---
name: current-frame
description: Resolve which frame and element the user is currently viewing in open-design-frame.
---

# Current Frame (`/current-frame`)

When the user says "this frame", "this screen", or "this element" without naming an id:

1. Read `node_modules/.open-design-frame/current.json` (or call the `current_frame` MCP tool).
2. The JSON contains:
   - `frameId`: the folder under `frames/<frameId>/index.tsx`
   - `frameIndex`: 0-based index in the exported array
   - `frameName`: the `frameName` of the active artboard
   - `viewMode`: `'single' | 'split' | 'grid'`
   - `selectedLoc`: `{ line, column }` of the currently selected JSX element on the canvas
   - `selectedLabel`: human-readable label of the selected layer/element
3. Edit `frames/<frameId>/index.tsx` directly at `selectedLoc` if a specific element is selected.
