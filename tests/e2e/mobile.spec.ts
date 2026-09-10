import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * The canvas display size is set in JavaScript, so layout is not final the
 * instant the game boots. Measuring before it settles reads a transient frame.
 */
async function waitForSettledLayout(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__dodge !== undefined, null, { timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      return canvas !== null && canvas.getBoundingClientRect().width > 0;
    },
    null,
    { timeout: 20_000 },
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test.describe('landscape phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps the whole HUD on screen beside the field', async ({ page }) => {
    await page.goto('/');
    await waitForSettledLayout(page);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(async () => page.evaluate(() => window.__dodge?.snapshot().phase), { timeout: 20_000 })
      .toBe('playing');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (viewport === null) return;

    // Regression: the HUD used to live inside the field, which on a landscape
    // phone is a narrow strip, so the chips were clipped by its overflow.
    for (const id of ['#hud-score', '#hud-best', '#hud-lives']) {
      const box = await page.locator(id).boundingBox();
      expect(box, `${id} should be laid out`).not.toBeNull();
      if (box === null) continue;
      expect(box.x, `${id} left edge`).toBeGreaterThanOrEqual(-0.5);
      expect(box.y, `${id} top edge`).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width, `${id} right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height, `${id} bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5);
    }
  });

  test('does not scroll the page', async ({ page }) => {
    await page.goto('/');
    await waitForSettledLayout(page);
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(overflow.x).toBeLessThanOrEqual(1);
    expect(overflow.y).toBeLessThanOrEqual(1);
  });
});

test.describe('small portrait phone', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

  test('fits the title screen and its controls on screen', async ({ page }) => {
    await page.goto('/');
    await waitForSettledLayout(page);

    const viewport = page.viewportSize();
    if (viewport === null) return;

    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toBeVisible();

    const box = await play.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
    // Comfortably tappable: the platform floor for a touch target is 44px.
    expect(box.height).toBeGreaterThanOrEqual(44);

    // Regression: a fixed min-width on the primary button used to burst out of
    // the panel whenever the field was height-limited and therefore narrow,
    // which scrolled the whole page sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
