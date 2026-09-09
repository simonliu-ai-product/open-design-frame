import { Command } from 'commander';
import { build } from './build.ts';
import { dev } from './dev.ts';

const program = new Command();

program.name('open-design-frame').description('Design frames, written as components.');

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

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
