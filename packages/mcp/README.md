# @open-design-frame/mcp

An MCP server for [open-design-frame](https://github.com/simonliu-ai-product/open-design-frame). It lets an
agent list, read, edit, comment on and file design frames in a workspace — over
stateless Streamable HTTP, no session handshake.

## Use it with the dev server

```bash
pnpm add -D @open-design-frame/mcp
open-design-frame dev --mcp        # canvas at :5274, MCP at :5274/mcp
```

Point any MCP client at `http://localhost:5274/mcp`. A tool call lands on disk
and the canvas hot-reloads, so an agent and a person work on one workspace.

## Tools

| | |
| --- | --- |
| `list_frames` `read_frame` `write_frame` | the frame files, with a revision — a stale write is refused with 409 |
| `create_frame` `rename_frame` `duplicate_frame` `delete_frame` | the folders under `frames/` |
| `current_frame` | the frame, artboard, and element currently selected in the browser |
| `list_templates` `create_from_template` | built-in starter templates (`blank`, `landing-page`, `mobile-app`, `dashboard-ui`, `social-poster`) |
| `check_frames` | static diagnostics across one or all frames (`parse-error`, `no-default-export`, `missing-size`, `hardcoded-color`, `missing-asset`) |
| `edit_element` | one element's style or text, addressed by the `data-odf-loc` the page reports |
| `read_changes` `list_revisions` `revert_change` | git diff hunks mapped to source lines, recent commits, and per-hunk revert |
| `list_comments` `add_comment` `delete_comment` | notes written into the frame's own source |
| `list_folders` `create_folder` `rename_folder` `delete_folder` `file_frame` | how the home page groups frames |
| `list_themes` `read_theme` `write_theme` | the design systems in `themes/` |
| `list_assets` `read_asset` `write_asset` `delete_asset` | the files frames draw with, with which frames use each |

Every tool is a thin wrapper over `@open-design-frame/core/ops` — the same functions the
dev server calls for the browser, including what they refuse.

## Mounting it yourself

```ts
import { createOpenDesignFrameMcpMiddleware } from '@open-design-frame/mcp';

app.use('/mcp', createOpenDesignFrameMcpMiddleware({ userCwd: process.cwd() }));
```

Host and Origin are checked against loopback by default; pass `allowedHosts`
only when the endpoint is deliberately exposed. These tools write to disk.

## License

MIT
