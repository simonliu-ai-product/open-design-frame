import path from 'node:path';

/**
 * Everything the operations need to know about a workspace.
 *
 * The dev server's routes and the MCP tools both build one of these and call
 * the same functions with it. Two implementations of "rename a frame" would
 * drift the first time one of them learned something the other did not.
 */
export type OpsContext = {
  userCwd: string;
  framesRoot: string;
  themesRoot: string;
  assetsRoot: string;
  version: string;
};

export type MakeContextOptions = {
  userCwd: string;
  framesDir?: string;
  themesDir?: string;
  assetsDir?: string;
  version?: string;
};

export function makeContext(opts: MakeContextOptions): OpsContext {
  const userCwd = path.resolve(opts.userCwd);
  return {
    userCwd,
    framesRoot: path.resolve(userCwd, opts.framesDir ?? 'frames'),
    themesRoot: path.resolve(userCwd, opts.themesDir ?? 'themes'),
    assetsRoot: path.resolve(userCwd, opts.assetsDir ?? 'assets'),
    version: opts.version ?? '0.0.0',
  };
}

/**
 * A refusal the caller can act on: a wrong id, a stale write, a file that is
 * not there. It carries the status the HTTP route would have sent, so the two
 * callers report the same thing in their own vocabulary.
 */
export class OpsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'OpsError';
    this.status = status;
  }
}

export const FRAME_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ENTRY_NAMES = ['index.tsx', 'index.jsx', 'index.ts', 'index.js'];

/** The folder a frame id names, or a refusal — never a path built from input. */
export function frameDir(ctx: OpsContext, frameId: unknown): string {
  if (typeof frameId !== 'string' || !FRAME_ID_RE.test(frameId)) {
    throw new OpsError(
      400,
      `'${String(frameId)}' is not a frame id — lowercase words with hyphens`,
    );
  }
  const dir = path.resolve(ctx.framesRoot, frameId);
  if (dir !== ctx.framesRoot && !dir.startsWith(ctx.framesRoot + path.sep)) {
    throw new OpsError(400, 'that frame is outside the frames folder');
  }
  return dir;
}

export { ENTRY_NAMES };
