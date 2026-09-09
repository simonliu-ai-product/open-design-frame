import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5274';
const FRAME_ID = 'agent-card';

/* ---------- the MCP half: this really creates the frame, on camera ---------- */
async function mcp(name, args) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const text = await res.text();
  const line = text.split('\n').find((l) => l.startsWith('data: '));
  const payload = JSON.parse(line.slice(6));
  if (payload.result?.isError) throw new Error(payload.result.content[0].text);
  return payload.result.content[0].text;
}

/*
 * Everything the film adds lives in the page: a caption, a cursor, a veil for
 * the cuts, and the two cards. In the page rather than in post, because then
 * what is recorded is what was on screen.
 */
const OVERLAY = `
  (() => {
    const mount = () => {
      const style = document.createElement('style');
      style.textContent = \`
        #of-cap {
          position: fixed; left: 0; right: 0; bottom: 48px; z-index: 99996;
          display: flex; justify-content: center; pointer-events: none;
        }
        #of-cap span {
          padding: 14px 26px; border-radius: 999px;
          background: rgba(14,14,17,.82); backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.10);
          color: #f2f2f4; font: 500 19px/1.3 -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
          letter-spacing: -0.01em; opacity: 0; transform: translateY(10px) scale(.98);
          transition: opacity .34s cubic-bezier(.22,.61,.36,1), transform .34s cubic-bezier(.22,.61,.36,1);
        }
        #of-cap span[data-on="1"] { opacity: 1; transform: none; }

        #of-cursor {
          position: fixed; top: 0; left: 0; z-index: 99997; width: 22px; height: 22px;
          margin: -11px 0 0 -11px; border-radius: 999px; pointer-events: none;
          background: rgba(255,255,255,.92);
          box-shadow: 0 0 0 6px rgba(255,255,255,.16), 0 6px 18px rgba(0,0,0,.4);
          opacity: 0;
          transition: transform .38s cubic-bezier(.22,.61,.36,1), opacity .3s ease, width .14s ease, height .14s ease;
        }
        #of-cursor[data-on="1"] { opacity: 1; }
        #of-cursor[data-press="1"] { width: 14px; height: 14px; margin: -7px 0 0 -7px; }

        #of-veil {
          position: fixed; inset: 0; z-index: 99998; background: #0b0b10;
          opacity: 1; pointer-events: none; transition: opacity .28s ease;
        }
        #of-veil[data-off="1"] { opacity: 0; }

        .of-card-full {
          position: fixed; inset: 0; z-index: 99999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 20px; text-align: center; background: #0b0b10; color: #f4f4f7;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
          opacity: 0; pointer-events: none; transition: opacity .55s ease;
        }
        .of-card-full[data-on="1"] { opacity: 1; }
        .of-card-full b {
          font-size: 76px; font-weight: 600; letter-spacing: -0.035em;
          opacity: 0; transform: translateY(14px);
          transition: opacity .6s ease .12s, transform .6s cubic-bezier(.22,.61,.36,1) .12s;
        }
        .of-card-full i {
          font-style: normal; font-size: 24px; color: #8b8b98;
          opacity: 0; transform: translateY(14px);
          transition: opacity .6s ease .26s, transform .6s cubic-bezier(.22,.61,.36,1) .26s;
        }
        .of-card-full code {
          margin-top: 10px; padding: 14px 26px; border-radius: 12px;
          border: 1px solid #24242f; background: #15151d; color: #f4f4f7;
          font: 20px ui-monospace, SFMono-Regular, Menlo, monospace;
          opacity: 0; transform: translateY(14px);
          transition: opacity .6s ease .4s, transform .6s cubic-bezier(.22,.61,.36,1) .4s;
        }
        .of-card-full em {
          font-style: normal; font-size: 15px; color: #6e6e78;
          letter-spacing: .16em; text-transform: uppercase;
          opacity: 0; transition: opacity .6s ease .54s;
        }
        .of-card-full[data-on="1"] b,
        .of-card-full[data-on="1"] i,
        .of-card-full[data-on="1"] code { opacity: 1; transform: none; }
        .of-card-full[data-on="1"] em { opacity: 1; }
      \`;
      document.head.appendChild(style);

      const add = (html) => {
        const el = document.createElement('div');
        el.innerHTML = html;
        document.body.appendChild(el.firstElementChild);
      };
      add('<div id="of-cap"><span></span></div>');
      add('<div id="of-cursor"></div>');
      add('<div id="of-veil"></div>');
      add('<div id="of-start" class="of-card-full"><b>open-frame</b>' +
          '<i>Design frames, written as components.</i></div>');
      add('<div id="of-end" class="of-card-full"><b>open-frame</b>' +
          '<i>Design frames, written as components.</i>' +
          '<code>github.com/simonliu-ai-product/open-frame</code>' +
          '<em>MIT · clone it and pnpm dev</em></div>');
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  })();
`;

const run = async () => {
  // A previous take may have left the frame behind; the point is to create it.
  await mcp('delete_frame', { frameId: FRAME_ID }).catch(() => {});

  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: 'video', size: { width: 1440, height: 900 } },
  });
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();

  const beat = (ms) => page.waitForTimeout(ms);
  const started = Date.now();
  const mark = (label) => console.log(`${((Date.now() - started) / 1000).toFixed(1)}s  ${label}`);
  const set = (selector, attr, value) =>
    page.evaluate(
      ([s, a, v]) => {
        const el = document.querySelector(s);
        if (!el) throw new Error(`${s} is missing`);
        if (v === null) el.removeAttribute(a);
        else el.setAttribute(a, v);
      },
      [selector, attr, value],
    );

  const cap = async (text) => {
    await page.waitForSelector('#of-cap span', { state: 'attached', timeout: 5000 });
    await page.evaluate((t) => {
      const el = document.querySelector('#of-cap span');
      el.textContent = t;
      el.dataset.on = t ? '1' : '0';
    }, text);
  };

  /* The cursor is real: the pointer goes where the dot goes, so hover happens too. */
  const pointerTo = async (locator, { settle = 420 } = {}) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('nothing to point at');
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.evaluate(
      ([px, py]) => {
        const c = document.querySelector('#of-cursor');
        c.dataset.on = '1';
        c.style.transform = `translate(${px}px, ${py}px)`;
      },
      [x, y],
    );
    await page.mouse.move(x, y, { steps: 16 });
    await beat(settle);
    return { x, y };
  };

  const press = async () => {
    await set('#of-cursor', 'data-press', '1');
    await beat(130);
    await set('#of-cursor', 'data-press', null);
  };

  const clickOn = async (locator, opts) => {
    await pointerTo(locator, opts);
    await press();
    await locator.click({ force: true });
  };

  /* Cuts fade rather than snap: a hard cut between two dark pages reads as a glitch. */
  const reveal = async () => {
    await page.waitForSelector('#of-veil', { state: 'attached' });
    await set('#of-veil', 'data-off', '1');
    await beat(300);
  };
  const hide = async () => {
    await set('#of-veil', 'data-off', null);
    await beat(290);
  };
  const goTo = async (url, ready) => {
    await hide();
    // The selector is what "ready" means here; waiting for the network to go
    // quiet holds the veil up long after there is something to look at.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (ready) await page.waitForSelector(ready);
    await reveal();
  };

  /* ================================ Opening ================================ */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  /*
   * The card comes up over the veil, not instead of it: fading both at once
   * would show the page ghosting through the title.
   */
  await set('#of-start', 'data-on', '1');
  await beat(2100);
  await set('#of-start', 'data-on', null);
  await set('#of-veil', 'data-off', '1');
  await beat(620);
  mark('opening card');

  /* ========================= Act 1 — an agent writes a frame ========================= */
  await cap('Frames are components. This is the project.');
  await beat(1300);

  await cap('An agent creates one over MCP…');
  await beat(900);
  await mcp('create_frame', { frameId: FRAME_ID, title: 'Release — v0.1' });
  const read = JSON.parse(await mcp('read_frame', { frameId: FRAME_ID }));
  await mcp('write_frame', {
    frameId: FRAME_ID,
    source: readFileSync('frame-source.tsx', 'utf8'),
    revision: read.revision,
  });
  await page.waitForSelector('text=Release — v0.1', { timeout: 15000 });
  await reveal();
  await cap('…and there it is — ordinary TSX on disk');
  await beat(1800);
  mark('act 1: written and shown');

  const card = page
    .locator('.of-card', { hasText: 'Release — v0.1' })
    .locator('.of-card-open')
    .first();
  await clickOn(card);
  await page.waitForSelector('.of-stage .of-frame');
  await cap('The canvas draws it at the size it ships at');
  await beat(1300);
  mark('act 2: opened');

  /* ================================ Act 2 — the page ================================ */
  await cap('Click anything on the canvas');
  const headline = page.locator('.of-stage [data-ofr-layer="Headline"]');
  await clickOn(headline, { settle: 440 });
  await beat(1150);

  await cap('Change a value and the canvas changes with it');
  const slider = page.locator('.of-slider').first();
  await pointerTo(slider, { settle: 300 });
  // Stepped rather than jumped: the point is watching it grow.
  for (const value of [66, 74, 82, 88, 92, 96]) {
    await slider.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await beat(110);
  }
  await beat(1050);

  await cap('Save writes it into the frame’s own source');
  await clickOn(page.locator('.of-save'), { settle: 340 });
  await beat(1400);
  mark('act 2: saved');

  await goTo(`${BASE}/f/flow-web`, '.of-stage .of-frame');
  await cap('Play it like a site — the links live in the frame');
  await clickOn(page.locator('.of-btn', { hasText: 'Play' }), { settle: 380 });
  await page.waitForSelector('.of-device');
  await beat(850);
  await clickOn(page.locator('.of-device [data-ofr-to="Transactions · Desktop"]').first(), {
    settle: 420,
  });
  await beat(800);
  await clickOn(page.locator('.of-device [data-ofr-to="Savings · Desktop"]').first(), {
    settle: 380,
  });
  await beat(900);
  await page.keyboard.press('Escape');
  mark('act 2: play');

  await goTo(`${BASE}/themes/aurora`, '.of-sheet');
  await cap('Every theme is a sheet, and a DESIGN.md');
  await beat(1500);
  await page.evaluate(() => {
    document.querySelector('.of-home')?.scrollTo({ top: 800, behavior: 'smooth' });
  });
  await beat(1900);
  mark('act 3: themes');

  /* ================================ Closing ================================ */
  await cap('');
  await beat(260);
  await set('#of-end', 'data-on', '1');
  await beat(3000);
  mark('end card');

  await context.close();
  await browser.close();
  console.log(`total ${((Date.now() - started) / 1000).toFixed(1)}s`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
