import fs from 'node:fs/promises';
import {
  addComment,
  type FrameComment,
  parseComments,
  removeComment,
} from '../editing/comments.ts';
import { type OpsContext, OpsError } from './context.ts';
import { frameFile } from './frames.ts';

export async function listComments(ctx: OpsContext, frameId: string): Promise<FrameComment[]> {
  const file = await frameFile(ctx, frameId);
  return parseComments(await fs.readFile(file, 'utf8'));
}

/**
 * A note beside the element it is about, written into the frame's own source.
 *
 * Where the note goes is a source location, so an agent leaves one exactly
 * where a person clicked — and the next person to open the file reads it there.
 */
export async function createComment(
  ctx: OpsContext,
  frameId: string,
  line: number,
  column: number,
  note: string,
): Promise<{ id: string; line: number }> {
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  const result = addComment(source, line, column, note);
  if (!result.ok) throw new OpsError(result.status, result.error);
  await fs.writeFile(file, result.source, 'utf8');
  return { id: result.id, line: result.line };
}

export async function deleteComment(
  ctx: OpsContext,
  frameId: string,
  commentId: string,
): Promise<{ ok: true }> {
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  const result = removeComment(source, commentId);
  if (!result.ok) throw new OpsError(result.status, result.error);
  await fs.writeFile(file, result.source, 'utf8');
  return { ok: true };
}
