/*
 * Does the viewer mount, from a real install?
 *
 * `build` resolves every module through Rollup and never asks Vite's dependency
 * optimizer anything, so it passed happily while `dev` served the viewer's own
 * `react-router-dom` unbundled and the page died before React mounted. Only
 * opening the dev server in a browser tells the two apart.
 *
 * It drives Chrome over CDP rather than `--dump-dom --virtual-time-budget`,
 * because the dev server holds an HMR socket open: virtual time never reaches
 * the budget and the dump never returns.
 *
 * Usage: node dev-smoke.mjs <page-url> <cdp-port>
 */
const pageUrl = process.argv[2];
const port = process.argv[3] ?? '9222';

const deadline = Date.now() + 30_000;
let targets;
for (;;) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {
    // Chrome is still coming up.
  }
  if (Date.now() > deadline) throw new Error('no debuggable Chrome page appeared');
  await new Promise((r) => setTimeout(r, 500));
}

const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let id = 1;
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push(d.exception?.description ?? d.text);
  }
});
const cdp = (method, params) => {
  const i = id++;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res) => {
    const on = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === i) {
        ws.removeEventListener('message', on);
        res(m);
      }
    };
    ws.addEventListener('message', on);
  });
};

await cdp('Runtime.enable');
await cdp('Page.enable');
await cdp('Page.navigate', { url: pageUrl });

/* The viewer loads its frames over several module requests; poll rather than
   guess a single sleep that is either flaky or slow. */
let mounted = false;
const until = Date.now() + 30_000;
while (Date.now() < until) {
  await new Promise((r) => setTimeout(r, 1000));
  const r = await cdp('Runtime.evaluate', {
    expression: `document.getElementById('root')?.childElementCount ?? 0`,
    returnByValue: true,
  });
  if ((r.result?.result?.value ?? 0) > 0) {
    mounted = true;
    break;
  }
}

ws.close();
if (errors.length > 0) {
  console.error('Uncaught errors on the page:');
  for (const e of errors) console.error(`  ${e.split('\n')[0]}`);
}
if (!mounted) {
  console.error(`#root is still empty: the viewer did not mount at ${pageUrl}`);
  process.exit(1);
}
if (errors.length > 0) process.exit(1);
console.log('viewer mounted, no uncaught errors');
