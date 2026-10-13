---
name: apply-comments
description: Apply all pending @frame-comment notes left on the canvas and remove the markers.
---

# Apply Frame Comments (`/apply-comments`)

Comments left on the canvas are stored directly inside `frames/<id>/index.tsx` as JSX comments:

```tsx
{/* @frame-comment id="c-..." ts="..." text="<base64url JSON>" */}
```

## Steps

1. Find all comments across `frames/**/index.tsx` (or use `list_comments` via MCP, or decode the `text` base64url JSON payload `{ "note": "..." }`).
2. Each marker sits inside the JSX element it refers to. Apply the requested design or copy change to that element.
3. Remove the `{/* @frame-comment ... */}` marker once the change is complete.
4. Run `npx open-design-frame check` to verify the updated frame files.
