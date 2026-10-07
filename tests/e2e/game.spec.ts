import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

interface DebugSnapshot {
  phase: string;
  mode: string;
  ghost: boolean;
  score: number;
  elapsed: number;
  lives: number;
  ship: { x: number; y: number };
  asteroids: number;
  seed: number;
  sector: number;
  shards: number;
  nearMisses: number;
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
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
}

async function startDaily(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Daily run/ }).click();
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
});

test('boots to the menu with a sized canvas', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Dodge Asteroid', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  const size = await page.locator('#game').evaluate((el: HTMLCanvasElement) => ({
    width: el.width,
    height: el.height,
  }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);

  expect((await snapshot(page)).phase).toBe('menu');
});

test('ships the link-preview image its social tags point to', async ({ page }) => {
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/\/og\.jpg$/);

  // The tag holds the absolute Pages URL; the same file must be in the build.
  const response = await page.request.get('/og.jpg');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/jpeg');
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

test('lets the explosion play out before the run-over screen', async ({ page }) => {
  await startRun(page);
  const box = await page.locator('#game').boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;

  // Sweep until the ship is hit, watching for the beat between the two.
  const phases = new Set<string>();
  const started = Date.now();
  while (Date.now() - started < 80_000) {
    const t = (Date.now() - started) / 1000;
    await page.mouse.move(
      box.x + box.width * (0.5 + Math.sin(t * 2.2) * 0.42),
      box.y + box.height * 0.42,
    );
    await page.waitForTimeout(16);
    const { phase } = await snapshot(page);
    phases.add(phase);
    if (phase === 'gameOver') break;
  }

  expect(phases.has('dying')).toBe(true);
  await expect(page.getByRole('heading', { name: 'Run over' })).toBeVisible();
});

test('the run-over screen explains the score', async ({ page }) => {
  await startRun(page);
  await crashTheShip(page);

  const stats = page.locator('#run-stats');
  await expect(stats).toContainText('Near misses');
  await expect(stats).toContainText('Best combo');
  await expect(stats).toContainText('Shards');
  await expect(stats).toContainText('Sector 1');

  // The run just finished is marked on the board.
  await expect(page.locator('#gameover-leaderboard [aria-current="true"]')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('the how-to-play screen opens at the top and comes back', async ({ page }) => {
  await page.getByRole('button', { name: 'How to play' }).click();
  const heading = page.getByRole('heading', { name: 'How to play' });
  await expect(heading).toBeInViewport();
  await expect(page.getByText('A red lane means a comet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeFocused();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('settings persist the music preference separately from sound', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Music').uncheck();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Music')).not.toBeChecked();
  await expect(page.getByLabel('Sound effects')).toBeChecked();
});

test('settings persist the sound preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Sound effects').uncheck();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);
  await expect(page.locator('#mute-state')).toHaveText('off');
});

test.describe('daily run', () => {
  test('is the same field on every attempt today, and unlike an endless run', async ({ page }) => {
    await startDaily(page);
    const first = await snapshot(page);
    expect(first.mode).toBe('daily');
    await expect(page.locator('#hud-mode')).toHaveText(/Daily #\d+/);

    await page.keyboard.press('KeyP');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await startDaily(page);
    expect((await snapshot(page)).seed).toBe(first.seed);

    await page.keyboard.press('KeyP');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await startRun(page);
    const endless = await snapshot(page);
    expect(endless.mode).toBe('endless');
    expect(endless.seed).not.toBe(first.seed);
    await expect(page.locator('#hud-mode')).toBeHidden();
  });

  test("records the attempt and shares the day's best", async ({ page, context }) => {
    // Force the clipboard path: a headless share sheet has nobody to answer it.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined });
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.__dodge !== undefined)).toBe(true);

    await startDaily(page);
    await crashTheShip(page);

    await expect(page.locator('#daily-result')).toContainText(
      /Daily #\d+ · best today [\d,]+ · 1 try/,
    );

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.locator('#share-status')).toHaveText('Copied to the clipboard.');
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(shared).toMatch(/^Dodge Asteroid · Daily #\d+\n/);
    expect(shared).toContain('1 try');
    expect(shared).toContain('https://mattathiasa.github.io/Dodge-Asteroid/');

    // The menu remembers today's result and starts the streak.
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#daily-meta')).toContainText('1 try');
    await expect(page.locator('#daily-meta')).toContainText('1-day streak');
  });
});

test.describe('ghost, missions and ship finishes', () => {
  test('replays the best daily attempt exactly, and races it next time', async ({ page }) => {
    await startDaily(page);
    expect((await snapshot(page)).ghost).toBe(false);
    await crashTheShip(page);

    // What the loop recorded must replay to the score the run actually got.
    const check = await page.evaluate(() => window.__dodge?.verifyBest() ?? null);
    expect(check).not.toBeNull();
    expect(check?.replayed).toBe(check?.stored);

    await page.getByRole('button', { name: 'Play again' }).click();
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    expect((await snapshot(page)).ghost).toBe(true);
    await expect(page.locator('#hud-best-label')).toHaveText('Ghost');
  });

  test('can race without the ghost', async ({ page }) => {
    await startDaily(page);
    await crashTheShip(page);
    await page.getByRole('button', { name: 'Main menu' }).click();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Race a ghost of your best daily attempt').uncheck();
    await page.getByRole('button', { name: 'Back' }).click();

    await startDaily(page);
    expect((await snapshot(page)).ghost).toBe(false);
    await expect(page.locator('#hud-best-label')).toHaveText('Best');
  });

  test("shows today's three missions, and counts a run toward them", async ({ page }) => {
    const missions = page.locator('#menu-missions li');
    await expect(missions).toHaveCount(3);
    await expect(missions.first()).toContainText(/\d/);

    await startRun(page);
    await crashTheShip(page);
    await expect(page.locator('#gameover-missions li')).toHaveCount(3);
  });

  test('offers only earned ship finishes, and says how to earn the rest', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('radio', { name: 'Mint' })).toBeChecked();
    const abyss = page.getByRole('radio', { name: /Abyss/ });
    await expect(abyss).toBeDisabled();
    await expect(page.locator('.hangar__option.is-locked').first()).toContainText('Reach Sector 3');
  });
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
