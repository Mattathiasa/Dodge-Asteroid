/**
 * Captures store-style marketing cards by actually playing the game.
 *
 * Run against a served production build:
 *   npm run build
 *   npm run preview -- --port 4173 --strictPort &
 *   node scripts/capture-store.mjs docs/store
 *
 * Each card is a caption over a shot of the play field itself, composed in a
 * headless page and screenshotted at 1242x2208 — the shape store listings use.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const OUT = process.argv[2] ?? 'docs/store';
const URL_ = process.env.CAPTURE_URL ?? 'http://127.0.0.1:4173/';

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

const CARDS = [
  {
    file: 's-play.png',
    line1: 'Thread the gap.',
    line2: 'Every near miss builds your combo.',
    accent: '#8fcf2f',
  },
  {
    file: 's-home.png',
    line1: 'One tap to fly.',
    line2: 'Mouse, finger or keyboard.',
    accent: '#f2792a',
  },
  {
    file: 's-gameover.png',
    line1: 'Beat your best.',
    line2: 'See exactly where the points came from.',
    accent: '#ff5fb4',
  },
  {
    file: 's-settings.png',
    line1: 'Play it your way.',
    line2: 'Three difficulties, reduced motion, music and sound.',
    accent: '#4ff0ff',
  },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(launchOptions);

// ---- 1. capture the play field on each screen ----
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 3,
});
const page = await context.newPage();
await page.goto(URL_);
await page.waitForFunction(() => window.__dodge !== undefined);

const snap = () => page.evaluate(() => window.__dodge.snapshot());
const shootField = (name) => page.locator('.stage').screenshot({ path: `${OUT}/${name}` });

await page.waitForTimeout(9000);
await shootField('s-home.png');

await page.getByRole('button', { name: 'Settings' }).click();
await page.waitForTimeout(500);
await shootField('s-settings.png');
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(400);

await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
  timeout: 20_000,
});
const box = await page.locator('#game').boundingBox();

let started = Date.now();
let busy = false;
while (!busy && Date.now() - started < 70_000) {
  const t = (Date.now() - started) / 1000;
  await page.mouse.move(
    box.x + box.width / 2 + Math.sin(t * 1.2) * box.width * 0.3,
    box.y + box.height * 0.8,
  );
  await page.waitForTimeout(16);
  const state = await snap();
  if (state.asteroids >= 5) {
    await shootField('s-play.png');
    busy = true;
  } else if (state.phase === 'gameOver') {
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
      timeout: 20_000,
    });
    started = Date.now();
  }
}

// Fly into traffic rather than waiting for a meteor to happen to land on us.
started = Date.now();
while (Date.now() - started < 80_000) {
  const t = (Date.now() - started) / 1000;
  await page.mouse.move(
    box.x + box.width * (0.5 + Math.sin(t * 2.2) * 0.42),
    box.y + box.height * 0.42,
  );
  await page.waitForTimeout(16);
  if ((await snap()).phase === 'gameOver') break;
}
// Long enough for the final score to finish counting up.
await page.waitForTimeout(1500);
await shootField('s-gameover.png');
await context.close();

// ---- 2. compose the cards ----
const b64 = (file) => readFileSync(`${OUT}/${file}`).toString('base64');

const card = (c) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Outfit:wght@400;600;700&display=swap">
<style>
 *{box-sizing:border-box} html,body{margin:0}
 body{width:1242px;height:2208px;overflow:hidden;
   background:radial-gradient(120% 60% at 50% 8%, #2d1861 0%, #170b3a 45%, #0a0620 100%);
   font-family:'Outfit',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
 .cap{padding:130px 80px 0;text-align:center}
 /* A dark stroke would vanish against this background, so the headline gets
    its weight from size and a coloured baseline instead. */
 .l1{font-family:'Bungee',sans-serif;font-size:82px;line-height:1.22;color:#fff3dc;
   text-shadow:0 8px 0 ${c.accent}, 0 22px 44px rgba(0,0,0,.65)}
 .l2{margin-top:40px;font-size:38px;font-weight:600;line-height:1.35;color:#c6b7e4}
 .shot{margin-top:86px;border:12px solid #1b0b36;border-radius:44px;overflow:hidden;
   box-shadow:0 26px 0 #1b0b36, 0 60px 90px rgba(0,0,0,.6);width:920px}
 .shot img{display:block;width:100%}
</style></head><body>
 <div class="cap"><div class="l1">${c.line1}</div><div class="l2">${c.line2}</div></div>
 <div class="shot"><img src="data:image/png;base64,${b64(c.file)}" alt=""></div>
</body></html>`;

const composer = await browser.newContext({
  viewport: { width: 1242, height: 2208 },
  deviceScaleFactor: 1,
});
const sheet = await composer.newPage();
const tmp = `${OUT}/_card.html`;

let index = 1;
for (const c of CARDS) {
  writeFileSync(tmp, card(c));
  await sheet.goto(`file://${process.cwd()}/${tmp}`);
  await sheet.waitForTimeout(2500);
  await sheet.screenshot({ path: `${OUT}/store-${String(index)}.png` });
  index += 1;
}

rmSync(tmp, { force: true });
// The per-screen sources are only inputs to the cards.
for (const c of CARDS) rmSync(`${OUT}/${c.file}`, { force: true });

console.log(`wrote ${String(CARDS.length)} store cards to ${OUT}`);
await composer.close();
await browser.close();
