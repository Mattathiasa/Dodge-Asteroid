/**
 * Captures the README screenshots and demo GIF by actually playing the game.
 *
 * Run it against a served production build:
 *   npm run build
 *   npm run preview -- --port 4173 --strictPort &
 *   node scripts/capture-media.mjs docs
 *
 * The ship is flown along a lissajous path so the capture shows real dodging
 * rather than a parked ship on an empty field.
 *
 * The GIF is encoded inside the page: frames are read straight off the game
 * canvas and quantised with gifenc there. Encoding in the browser avoids
 * depending on a full ffmpeg build, since the one bundled with Playwright has
 * no GIF encoder.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const OUT = process.argv[2] ?? 'docs';
const URL_ = process.env.CAPTURE_URL ?? 'http://127.0.0.1:4173/';

const GIF_WIDTH = Number(process.env.GIF_WIDTH ?? 300);
const GIF_FPS = Number(process.env.GIF_FPS ?? 14);
const GIF_SECONDS = Number(process.env.GIF_SECONDS ?? 7);

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

mkdirSync(OUT, { recursive: true });

const gifencSource = readFileSync(require.resolve('gifenc/dist/gifenc.esm.js'), 'utf8');

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 900, height: 760 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(URL_);
await page.waitForFunction(() => window.__dodge !== undefined);

const box = await page.locator('#game').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/menu.png` });

// Load the encoder as a real module, so its own export names are used.
await page.evaluate(async (source) => {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  window.__gifenc = await import(url);
}, gifencSource);

await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
  timeout: 20_000,
});

// Kick off recording without awaiting, so the mouse can fly the ship while the
// page records.
const recording = page.evaluate(
  async ({ width, fps, seconds }) => {
    const { GIFEncoder, quantize, applyPalette } = window.__gifenc;
    const source = document.getElementById('game');
    const height = Math.round((width * source.height) / source.width);

    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });

    const encoder = GIFEncoder();
    const delay = Math.round(1000 / fps);
    const totalFrames = Math.round(fps * seconds);

    for (let i = 0; i < totalFrames; i += 1) {
      ctx.drawImage(source, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      // A per-frame palette keeps the neon glow from banding.
      const palette = quantize(data, 128, { format: 'rgb565' });
      encoder.writeFrame(applyPalette(data, palette, 'rgb565'), width, height, {
        palette,
        delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    encoder.finish();
    const bytes = encoder.bytes();
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { base64: btoa(binary), frames: totalFrames, width, height };
  },
  { width: GIF_WIDTH, fps: GIF_FPS, seconds: GIF_SECONDS },
);

// Fly the ship for as long as the recording lasts, restarting if it ends.
const deadline = Date.now() + GIF_SECONDS * 1000 + 1500;
const started = Date.now();
let actionShot = false;

while (Date.now() < deadline) {
  const t = (Date.now() - started) / 1000;
  await page.mouse.move(
    cx + Math.sin(t * 1.15) * box.width * 0.32,
    cy + Math.sin(t * 0.73 + 1) * box.height * 0.2 + box.height * 0.14,
  );
  await page.waitForTimeout(16);

  const state = await page.evaluate(() => window.__dodge.snapshot());
  if (!actionShot && (state.asteroids >= 5 || state.elapsed >= 4.5)) {
    await page.screenshot({ path: `${OUT}/gameplay.png` });
    actionShot = true;
  }
  if (state.phase === 'gameOver') {
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
      timeout: 20_000,
    });
  }
}

if (!actionShot) await page.screenshot({ path: `${OUT}/gameplay.png` });

const gif = await recording;
writeFileSync(`${OUT}/demo.gif`, Buffer.from(gif.base64, 'base64'));
console.log(`demo.gif: ${gif.frames} frames at ${gif.width}x${gif.height}`);

await context.close();
await browser.close();
