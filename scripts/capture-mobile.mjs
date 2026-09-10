/**
 * Captures the phone screenshots used in the README.
 *
 * Like scripts/capture-media.mjs, these are taken from the real built game so
 * they cannot drift from what the code does.
 *
 *   npm run build && npm run preview -- --host 127.0.0.1 --port 4173 &
 *   node scripts/capture-mobile.mjs docs/mobile
 */
import { chromium, devices } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'docs/mobile';
const URL_ = process.env.CAPTURE_URL ?? 'http://127.0.0.1:4173/';

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(launchOptions);

/** Flies the ship until the field has a few meteors on it, then shoots. */
async function capture(name, contextOptions, { play }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(URL_);
  await page.waitForFunction(() => window.__dodge !== undefined, null, { timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      return canvas !== null && canvas.getBoundingClientRect().width > 0;
    },
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(900);

  if (play) {
    await page.getByRole('button', { name: 'Play' }).click();
    await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
      timeout: 20_000,
    });
    const box = await page.locator('#game').boundingBox();
    const started = Date.now();
    while (Date.now() - started < 25_000) {
      const t = (Date.now() - started) / 1000;
      await page.mouse.move(
        box.x + box.width / 2 + Math.sin(t * 1.2) * box.width * 0.3,
        box.y + box.height * 0.76,
      );
      await page.waitForTimeout(20);
      const state = await page.evaluate(() => window.__dodge.snapshot());
      if (state.asteroids >= 4) break;
      if (state.phase === 'gameOver') {
        await page.getByRole('button', { name: 'Play again' }).click();
        await page.waitForFunction(() => window.__dodge.snapshot().phase === 'playing', null, {
          timeout: 20_000,
        });
      }
    }
  }

  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
  await context.close();
}

const phone = devices['Pixel 7'];
await capture('portrait-menu', { ...phone }, { play: false });
await capture('portrait-play', { ...phone }, { play: true });
await capture(
  'landscape-play',
  { ...phone, viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true },
  { play: true },
);

await browser.close();
