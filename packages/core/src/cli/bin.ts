import { Command } from 'commander';
import {
  checkFrames,
  createFromTemplate,
  listFrames,
  listTemplates,
  makeContext,
  readChanges,
} from '../ops/index.ts';
import { build } from './build.ts';
import { dev } from './dev.ts';
import { initWorkspace } from './init.ts';
import { preview } from './preview.ts';
import { syncSkills } from './sync.ts';

const program = new Command();

program.name('open-design-frame').description('Design frames, written as components.');

program
  .command('init [dir]')
  .description('Scaffold an open-design-frame workspace with agent skills and MCP config')
  .option('-t, --template <name>', 'starter frame template', 'landing-page')
  .option('--name <name>', 'package name')
  .option('-f, --force', 'scaffold even if directory is not empty')
  .action(
    async (
      dir: string | undefined,
      opts: { template?: string; name?: string; force?: boolean },
    ) => {
      const res = await initWorkspace({
        ...(dir !== undefined ? { dir } : {}),
        ...(opts.template !== undefined ? { template: opts.template } : {}),
        ...(opts.name !== undefined ? { name: opts.name } : {}),
        ...(opts.force !== undefined ? { force: opts.force } : {}),
      });
      process.stdout.write(
        `Initialized workspace at ${res.dir}\n  Starter frame: ${res.frameFile}\n  Synced skills: ${res.skills.join(', ')}\n`,
      );
    },
  );

program
  .command('dev')
  .description('Open the canvas with hot reload')
  .option('-p, --port <port>', 'port to listen on', (v) => Number.parseInt(v, 10))
  .option('--host [host]', 'expose on the network')
  .option('--mcp', 'serve an MCP endpoint at /mcp (requires @open-design-frame/mcp)')
  .action(async (opts: { port?: number; host?: string | boolean; mcp?: boolean }) => {
    await dev(opts);
  });

program
  .command('build')
  .description('Build a static canvas into dist/')
  .option('--out-dir <dir>', 'output directory')
  .action(async (opts: { outDir?: string }) => {
    await build(opts);
  });

program
  .command('preview')
  .description('Preview the built static site')
  .option('-p, --port <port>', 'port to listen on', (v) => Number.parseInt(v, 10))
  .option('--host [host]', 'expose on the network')
  .action(async (opts: { port?: number; host?: string | boolean }) => {
    await preview(opts);
  });

program
  .command('check [ids...]')
  .description('Check frames for syntax, prototype links, missing assets and declarations')
  .option('--json', 'print JSON report')
  .action(async (ids: string[], opts: { json?: boolean }) => {
    const ctx = makeContext({ userCwd: process.cwd() });
    const result = await checkFrames(ctx, ids.length > 0 ? ids : undefined);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      for (const report of result.reports) {
        const errors = report.findings.filter((f) => f.severity === 'error').length;
        const warns = report.findings.filter((f) => f.severity === 'warn').length;
        const mark = errors > 0 ? '✗' : '✓';
        process.stdout.write(
          `${mark} ${report.id} (${report.frameCount} ${report.frameCount === 1 ? 'frame' : 'frames'})` +
            (errors || warns ? ` — ${errors} error(s), ${warns} warning(s)` : '') +
            '\n',
        );
        for (const finding of report.findings) {
          const icon = finding.severity === 'error' ? '✗' : '!';
          const at = finding.loc ? `  @ ${finding.loc}` : '';
          process.stdout.write(`  ${icon} [${finding.rule}] ${finding.message}${at}\n`);
        }
      }
    }
    if (!result.ok) process.exit(1);
  });

program
  .command('templates')
  .description('List available frame templates')
  .option('--json', 'print JSON list')
  .action(async (opts: { json?: boolean }) => {
    const ctx = makeContext({ userCwd: process.cwd() });
    const templates = await listTemplates(ctx);
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(templates, null, 2)}\n`);
      return;
    }
    for (const tpl of templates) {
      process.stdout.write(`${tpl.name.padEnd(16)} ${tpl.title.padEnd(22)} ${tpl.description}\n`);
    }
  });

program
  .command('new [id]')
  .description('Create a new frame from a template')
  .option('-t, --template <name>', 'template name (see `open-design-frame templates`)', 'blank')
  .option('--title <title>', 'human-readable frame title')
  .option('--json', 'print JSON result')
  .action(
    async (id: string | undefined, opts: { template: string; title?: string; json?: boolean }) => {
      const ctx = makeContext({ userCwd: process.cwd() });
      const created = await createFromTemplate(ctx, {
        template: opts.template,
        ...(id !== undefined ? { frameId: id } : {}),
        ...(opts.title !== undefined ? { title: opts.title } : {}),
      });
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(created, null, 2)}\n`);
      } else {
        process.stdout.write(`Created ${created.id} → ${created.file}\n`);
      }
    },
  );

program
  .command('diff [ids...]')
  .description('Show what changed in frame sources since a git revision, mapped to canvas elements')
  .option('--since <rev>', 'git revision to diff against', 'HEAD')
  .option('--json', 'print JSON report')
  .action(async (ids: string[], opts: { since: string; json?: boolean }) => {
    const ctx = makeContext({ userCwd: process.cwd() });
    const targetIds = ids.length > 0 ? ids : (await listFrames(ctx)).map((entry) => entry.id);
    const reports = [];
    for (const id of targetIds) {
      const diff = await readChanges(ctx, id, opts.since);
      reports.push({ id, ...diff });
    }
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
      return;
    }
    for (const report of reports) {
      if (!report.available) {
        process.stdout.write(`${report.id}: git diff unavailable (${report.reason})\n`);
        continue;
      }
      const hunkCount = report.files.reduce((sum, f) => sum + f.hunks.length, 0);
      process.stdout.write(
        `${report.id} (since ${report.since}): ${report.files.length} file(s), ${hunkCount} hunk(s)\n`,
      );
      for (const file of report.files) {
        for (const hunk of file.hunks) {
          const targets = hunk.targets.map((t) => `${t.mark}@${t.loc}`).join(', ');
          process.stdout.write(
            `  · ${file.path} line ${hunk.newStart} (-${hunk.removed.length}/+${hunk.added.length})` +
              (targets ? ` [${targets}]` : '') +
              '\n',
          );
        }
      }
    }
  });

program
  .command('sync-skills')
  .description('Sync built-in agent skills into .agents/skills and .claude/skills')
  .action(async () => {
    const synced = await syncSkills(process.cwd());
    process.stdout.write(`Synced ${synced.length} skill(s): ${synced.join(', ')}\n`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
