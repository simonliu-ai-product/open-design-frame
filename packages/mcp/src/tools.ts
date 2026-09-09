import { Buffer } from 'node:buffer';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  assignFrameToFolder,
  createComment,
  createFolder,
  createFrame,
  deleteAsset,
  deleteComment,
  deleteFolder,
  deleteFrame,
  duplicateFrame,
  editElement,
  listAssets,
  listComments,
  listFrames,
  listThemes,
  type OpsContext,
  OpsError,
  readAsset,
  readFolders,
  readFrame,
  readTheme,
  readThemeDoc,
  renameFolder,
  renameFrame,
  writeAsset,
  writeFrame,
  writeTheme,
  writeThemeDoc,
} from '@open-frame/core/ops';
import { z } from 'zod';

/**
 * Every tool is a thin wrapper over `@open-frame/core/ops` — the same functions
 * the dev server calls for the browser. An agent and a person editing the same
 * workspace therefore go through one implementation, including its refusals.
 */

const FRAME_ID = z.string().describe('frame id — the folder name under frames/');

/** Tools return text; JSON payloads go through as pretty-printed text blocks. */
function ok(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * An OpsError is a refusal the caller can act on (404 wrong id, 409 stale
 * write), so it comes back as a tool error rather than a transport failure.
 */
async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof OpsError) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `${err.status}: ${err.message}` }],
      };
    }
    throw err;
  }
}

export function registerTools(server: McpServer, ctx: OpsContext): void {
  server.registerTool(
    'list_frames',
    {
      title: 'List frames',
      description:
        'Every frame file in the workspace: id, title, folder, revision, and the frames it ' +
        'declares with their names and sizes. Start here.',
      inputSchema: z.object({}),
    },
    () => run(() => listFrames(ctx)),
  );

  server.registerTool(
    'read_frame',
    {
      title: 'Read a frame',
      description:
        'The full source of frames/<id>/index.tsx, with the revision to pass back to write_frame.',
      inputSchema: z.object({ frameId: FRAME_ID }),
    },
    ({ frameId }) => run(() => readFrame(ctx, frameId)),
  );

  server.registerTool(
    'write_frame',
    {
      title: 'Write a frame',
      description:
        'Replace the source of a frame file. Pass the revision you read: a write against an ' +
        'older one is refused with 409 rather than overwriting whoever changed it.',
      inputSchema: z.object({
        frameId: FRAME_ID,
        source: z.string().describe('the complete new file contents'),
        revision: z
          .string()
          .optional()
          .describe('the revision from read_frame; omit only to force the write'),
      }),
    },
    ({ frameId, source, revision }) => run(() => writeFrame(ctx, frameId, source, revision)),
  );

  server.registerTool(
    'create_frame',
    {
      title: 'Create a frame',
      description: 'Scaffold frames/<id>/index.tsx with one desktop frame in it.',
      inputSchema: z.object({
        frameId: FRAME_ID,
        title: z.string().optional().describe('what the home page calls it'),
      }),
    },
    ({ frameId, title }) => run(() => createFrame(ctx, frameId, title)),
  );

  server.registerTool(
    'rename_frame',
    {
      title: 'Rename a frame',
      description:
        "Write the frame's meta.title. The folder is left alone: its name is the id, and the " +
        'id is in the URL, in the asset paths beside it, and in whatever links to it.',
      inputSchema: z.object({ frameId: FRAME_ID, title: z.string() }),
    },
    ({ frameId, title }) => run(() => renameFrame(ctx, frameId, title)),
  );

  server.registerTool(
    'duplicate_frame',
    {
      title: 'Duplicate a frame',
      description: 'Copy the whole folder, assets included, and keep its folder assignment.',
      inputSchema: z.object({
        frameId: FRAME_ID,
        newId: z.string().optional().describe('defaults to <id>-copy'),
      }),
    },
    ({ frameId, newId }) => run(() => duplicateFrame(ctx, frameId, newId)),
  );

  server.registerTool(
    'delete_frame',
    {
      title: 'Delete a frame',
      description: 'Remove frames/<id>/ and everything in it. There is no undo.',
      inputSchema: z.object({ frameId: FRAME_ID }),
    },
    ({ frameId }) => run(() => deleteFrame(ctx, frameId)),
  );

  server.registerTool(
    'edit_element',
    {
      title: 'Edit one element',
      description:
        'Change the style or text of the element written at line:column — the location the ' +
        'page reports in data-of-loc. Refuses an element that takes its style from a shared ' +
        'value, since changing that would restyle everything else using it.',
      inputSchema: z.object({
        frameId: FRAME_ID,
        line: z.number().int().positive().describe('1-based line from data-of-loc'),
        column: z.number().int().nonnegative().describe('0-based column from data-of-loc'),
        ops: z
          .array(
            z.union([
              z.object({
                kind: z.literal('set-style'),
                key: z.string().describe('a React style key, e.g. fontSize'),
                value: z.string().nullable().describe('null removes the property'),
              }),
              z.object({ kind: z.literal('set-text'), value: z.string() }),
            ]),
          )
          .min(1),
      }),
    },
    ({ frameId, line, column, ops }) => run(() => editElement(ctx, frameId, line, column, ops)),
  );

  server.registerTool(
    'list_comments',
    {
      title: 'List comments',
      description:
        'The notes left on a frame, read from the JSX comments in its own source, with the ' +
        'line each one sits on.',
      inputSchema: z.object({ frameId: FRAME_ID }),
    },
    ({ frameId }) => run(() => listComments(ctx, frameId)),
  );

  server.registerTool(
    'add_comment',
    {
      title: 'Leave a comment',
      description:
        'Write a note into the frame beside the element at line:column, where whoever opens ' +
        'the file next will read it.',
      inputSchema: z.object({
        frameId: FRAME_ID,
        line: z.number().int().positive(),
        column: z.number().int().nonnegative(),
        note: z.string(),
      }),
    },
    ({ frameId, line, column, note }) => run(() => createComment(ctx, frameId, line, column, note)),
  );

  server.registerTool(
    'delete_comment',
    {
      title: 'Delete a comment',
      description: 'Take one note back out of the source, leaving the markup as it was.',
      inputSchema: z.object({ frameId: FRAME_ID, commentId: z.string() }),
    },
    ({ frameId, commentId }) => run(() => deleteComment(ctx, frameId, commentId)),
  );

  server.registerTool(
    'list_folders',
    {
      title: 'List folders',
      description: 'The folders the home page groups frames into, and which frame is in which.',
      inputSchema: z.object({}),
    },
    () => run(() => readFolders(ctx)),
  );

  server.registerTool(
    'create_folder',
    {
      title: 'Create a folder',
      description: 'A folder is a label, not a directory — creating one moves no files.',
      inputSchema: z.object({ name: z.string() }),
    },
    ({ name }) => run(() => createFolder(ctx, name)),
  );

  server.registerTool(
    'rename_folder',
    {
      title: 'Rename a folder',
      inputSchema: z.object({ folderId: z.string(), name: z.string() }),
    },
    ({ folderId, name }) => run(() => renameFolder(ctx, folderId, name)),
  );

  server.registerTool(
    'delete_folder',
    {
      title: 'Delete a folder',
      description: 'The frames in it become unfiled; nothing on disk moves.',
      inputSchema: z.object({ folderId: z.string() }),
    },
    ({ folderId }) => run(() => deleteFolder(ctx, folderId)),
  );

  server.registerTool(
    'file_frame',
    {
      title: 'Move a frame into a folder',
      description: 'Pass folderId null to unfile it.',
      inputSchema: z.object({ frameId: FRAME_ID, folderId: z.string().nullable() }),
    },
    ({ frameId, folderId }) => run(() => assignFrameToFolder(ctx, frameId, folderId)),
  );

  server.registerTool(
    'list_themes',
    {
      title: 'List themes',
      description: 'The design systems in themes/, which a frame uses by exporting one as design.',
      inputSchema: z.object({}),
    },
    () => run(() => listThemes(ctx)),
  );

  server.registerTool(
    'read_theme',
    { title: 'Read a theme', inputSchema: z.object({ themeId: z.string() }) },
    ({ themeId }) => run(() => readTheme(ctx, themeId)),
  );

  server.registerTool(
    'write_theme',
    {
      title: 'Write a theme',
      description: 'Create or replace themes/<id>.ts. It must default-export a DesignSystem.',
      inputSchema: z.object({ themeId: z.string(), source: z.string() }),
    },
    ({ themeId, source }) => run(() => writeTheme(ctx, themeId, source)),
  );

  server.registerTool(
    'read_design_doc',
    {
      title: "Read a theme's DESIGN.md",
      description:
        'The design document beside a theme: atmosphere, colour, typography, spacing, ' +
        "component rules, do's and don'ts. Read this before building anything in that theme.",
      inputSchema: z.object({ themeId: z.string() }),
    },
    ({ themeId }) => run(() => readThemeDoc(ctx, themeId)),
  );

  server.registerTool(
    'write_design_doc',
    {
      title: "Write a theme's DESIGN.md",
      description:
        'Create or replace the design document. Keep it specific and quantified — `#1A73E8`, ' +
        'not "a trustworthy blue" — and do not let it drift from the tokens beside it.',
      inputSchema: z.object({ themeId: z.string(), markdown: z.string() }),
    },
    ({ themeId, markdown }) => run(() => writeThemeDoc(ctx, themeId, markdown)),
  );

  server.registerTool(
    'list_assets',
    {
      title: 'List assets',
      description:
        'Every file a frame can draw with, in both scopes, with which frames mention it by ' +
        'name — so an unused one is visible.',
      inputSchema: z.object({
        scope: z
          .string()
          .optional()
          .describe("'@global' for the project folder, or a frame id; omit for every scope"),
      }),
    },
    ({ scope }) => run(() => listAssets(ctx, scope)),
  );

  server.registerTool(
    'read_asset',
    {
      title: 'Read an asset',
      description: 'The file as base64, with its media type.',
      inputSchema: z.object({ scope: z.string(), name: z.string() }),
    },
    ({ scope, name }) =>
      run(async () => {
        const asset = await readAsset(ctx, scope, name);
        return { name, scope, type: asset.type, base64: asset.bytes.toString('base64') };
      }),
  );

  server.registerTool(
    'write_asset',
    {
      title: 'Write an asset',
      description: 'Put a file in a scope. Content is base64.',
      inputSchema: z.object({ scope: z.string(), name: z.string(), base64: z.string() }),
    },
    ({ scope, name, base64 }) =>
      run(() => writeAsset(ctx, scope, name, Buffer.from(base64, 'base64'))),
  );

  server.registerTool(
    'delete_asset',
    {
      title: 'Delete an asset',
      inputSchema: z.object({ scope: z.string(), name: z.string() }),
    },
    ({ scope, name }) => run(() => deleteAsset(ctx, scope, name)),
  );
}
