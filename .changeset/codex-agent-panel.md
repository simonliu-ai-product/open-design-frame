---
"@open-design-frame/core": minor
---

An agent beside the canvas: `open-design-frame dev` has a Codex panel (A) that works in the workspace on your own Codex sign-in. A turn knows the file, the artboard on screen and the element picked on the canvas; when it ends, the dev server checks the files it changed (and draws them when Playwright is installed) and offers the findings back to the agent. Conversations stay in `node_modules/.open-design-frame/`. `dev --no-agent` leaves it out, and a host app that declares the open-x `agent` capability hides it.
