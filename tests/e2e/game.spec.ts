import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

interface DebugSnapshot {
  phase: string;
  score: number;
  elapsed: number;
  lives: number;
  ship: { x: number; y: number };
  asteroids: number;
  seed: number;
}

async function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => {
    const api = window.__dodge;
    if (api === undefined) throw new Error('game not booted');
    return api.snapshot();
  });
}

/**
 * Flies the ship across the field until it is destroyed.
 *
 * Parking in the middle and waiting for a meteor to happen to land on you is a
 * coin flip that can take a very long time; sweeping across traffic makes the
 * crash prompt and the test predictable.
 */
async function crashTheShip(page: Page): Promise<void> {
  const box = await page.locator('#game').boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;

  const started = Date.now();
  while (Date.now() - started < 80_000) {
    const t = (Date.now() - started) / 1000;
    await page.mouse.move(
      box.x + box.width * (0.5 + Math.sin(t * 2.2) * 0.42),
      box.y + box.height * 0.42,
    );
    await page.waitForTimeout(16);
    if ((await snapshot(page)).phase === 'gameOver') return;
  }
  throw new Error('ship survived the whole sweep; expected a collision');
}

/** Waits until the game leaves the countdown and is actually simulating. */
async function startRun(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
});

test('boots to the menu with a sized canvas', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Dodge Asteroid', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  const size = await page.locator('#game').evaluate((el: HTMLCanvasElement) => ({
    width: el.width,
    height: el.height,
  }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);

  expect((await snapshot(page)).phase).toBe('menu');
});

test('starts a run and accumulates score over time', async ({ page }) => {
  await startRun(page);
  await expect
    .poll(async () => (await snapshot(page)).score, { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect(page.locator('#hud-score')).not.toHaveText('0');
});

test('the ship follows the pointer', async ({ page }) => {
  await startRun(page);
  const box = await page.locator('#game').boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4);
  await page.waitForTimeout(600);
  const left = (await snapshot(page)).ship;

  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4);
  await page.waitForTimeout(600);
  const right = (await snapshot(page)).ship;

  expect(right.x).toBeGreaterThan(left.x + 20);
});

test('the ship responds to the keyboard', async ({ page }) => {
  await startRun(page);
  const before = (await snapshot(page)).ship;

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft');

  expect((await snapshot(page)).ship.x).toBeLessThan(before.x - 10);
});

test('pause actually freezes the world, and resume continues it', async ({ page }) => {
  await startRun(page);
  await page.waitForTimeout(500);

  await page.keyboard.press('KeyP');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();

  const frozen = await snapshot(page);
  await page.waitForTimeout(900);
  const stillFrozen = await snapshot(page);

  // This is the behaviour that never worked in the original: `animateAsteroids`
  // was undefined, so resuming threw and asteroids stayed stuck mid-air.
  expect(stillFrozen.elapsed).toBeCloseTo(frozen.elapsed, 3);
  expect(stillFrozen.score).toBe(frozen.score);

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(async () => (await snapshot(page)).elapsed).toBeGreaterThan(frozen.elapsed);
});

test('ends the run with an in-page screen, never a native alert', async ({ page }) => {
  let nativeDialog = false;
  page.on('dialog', (dialog) => {
    nativeDialog = true;
    void dialog.dismiss();
  });

  await startRun(page);

  await crashTheShip(page);

  await expect(page.getByRole('heading', { name: 'Run over' })).toBeVisible();
  expect(nativeDialog).toBe(false);
});

test('persists the best score across a reload', async ({ page }) => {
  await startRun(page);
  await page.waitForTimeout(2500);

  await crashTheShip(page);

  const stored = await page.evaluate(() => localStorage.getItem('dodge-asteroid:profile'));
  expect(stored).not.toBeNull();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
  const best = await page.locator('#hud-best').textContent();
  expect(Number(best?.replace(/\D/g, '') ?? '0')).toBeGreaterThan(0);
});

test('restarts from the game-over screen', async ({ page }) => {
  await startRun(page);
  await crashTheShip(page);

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
  expect((await snapshot(page)).score).toBeLessThan(50);
});

test('the about screen replaces the original broken link', async ({ page }) => {
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mattathias Abraham' })).toHaveAttribute(
    'href',
    'https://github.com/Mattathiasa',
  );
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('settings persist the sound preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Sound effects').uncheck();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
  await expect(page.locator('#mute-state')).toHaveText('off');
});

test.describe('touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch-only behaviour');

  test('steers by touch', async ({ page }) => {
    await startRun(page);
    const box = await page.locator('#game').boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    const y = box.y + box.height * 0.7;
    await page.touchscreen.tap(box.x + box.width * 0.3, y);
    await page.waitForTimeout(700);
    const left = (await snapshot(page)).ship;

    await page.touchscreen.tap(box.x + box.width * 0.75, y);
    await page.waitForTimeout(700);
    const right = (await snapshot(page)).ship;

    expect(right.x).toBeGreaterThan(left.x + 20);
  });

  test('keeps the ship clear of the fingertip', async ({ page }) => {
    await startRun(page);
    const box = await page.locator('#game').boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.65;

    // Same screen point, two input types. Comparing them sidesteps any
    // letterbox arithmetic in the test itself.
    await page.mouse.move(x, y);
    await page.waitForTimeout(800);
    const byMouse = (await snapshot(page)).ship;

    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(800);
    const byTouch = (await snapshot(page)).ship;

    // Touch steers a point above the finger, so a fingertip does not cover the
    // ship the player is trying to fly.
    expect(byTouch.y).toBeLessThan(byMouse.y - 15);
  });
});
