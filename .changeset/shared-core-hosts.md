---
"@open-design-frame/core": minor
---

A workspace no longer needs its own install to be served: frames always import the running core and its React, so a host app can serve many workspaces from one shared core (with a normal install that is the same copy). `OPEN_DESIGN_FRAME_CACHE_DIR` gives each workspace its own Vite cache instead of the one beside core.
