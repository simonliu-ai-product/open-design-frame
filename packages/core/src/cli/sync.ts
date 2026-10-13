import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findCoreRoot(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

export async function syncSkills(userCwd = process.cwd()): Promise<string[]> {
  const root = findCoreRoot();
  if (!root) return [];
  const skillsSrc = path.join(root, 'skills');
  if (!existsSync(skillsSrc)) return [];

  const entries = await fs.readdir(skillsSrc, { withFileTypes: true });
  const synced: string[] = [];

  for (const targetRoot of [
    path.join(userCwd, '.agents', 'skills'),
    path.join(userCwd, '.claude', 'skills'),
  ]) {
    await fs.mkdir(targetRoot, { recursive: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const srcDir = path.join(skillsSrc, entry.name);
      const dstDir = path.join(targetRoot, entry.name);
      await fs.cp(srcDir, dstDir, { recursive: true });
      if (!synced.includes(entry.name)) synced.push(entry.name);
    }
  }
  return synced.sort();
}
