import fs from 'node:fs/promises';
import path from 'node:path';
import type { OpsContext } from './context.ts';

export type CurrentFrameState = {
  frameId: string | null;
  frameIndex: number;
  frameName: string | null;
  viewMode?: 'single' | 'split' | 'grid';
  selectedLoc?: { line: number; column: number } | null;
  selectedLabel?: string | null;
  updatedAt: string;
};

function currentFile(ctx: OpsContext): string {
  return path.join(ctx.userCwd, 'node_modules', '.open-design-frame', 'current.json');
}

export async function readCurrentFrame(ctx: OpsContext): Promise<CurrentFrameState | null> {
  try {
    const raw = await fs.readFile(currentFile(ctx), 'utf8');
    return JSON.parse(raw) as CurrentFrameState;
  } catch {
    return null;
  }
}

export async function writeCurrentFrame(
  ctx: OpsContext,
  state: Omit<CurrentFrameState, 'updatedAt'>,
): Promise<CurrentFrameState> {
  const file = currentFile(ctx);
  const full: CurrentFrameState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(full, null, 2)}\n`, 'utf8');
  return full;
}
