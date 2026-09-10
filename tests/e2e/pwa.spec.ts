import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** Waits until a service worker is actually controlling the page. */
async function waitForController(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  });
}

test('serves a valid, installable web app manifest', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();

  const response = await request.get(new URL(href ?? '', page.url()).toString());
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    name: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };

  expect(manifest.name).toBe('Dodge Asteroid');
  expect(manifest.display).toBe('standalone');

  // The install prompt needs a 192px icon and a maskable one, or Chrome
  // silently declines to offer installation.
  const sizes = manifest.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  // Every icon the manifest promises must actually be served.
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, page.url()).toString());
    expect(iconResponse.ok(), `${icon.src} should be served`).toBe(true);
  }
});

test('registers a service worker that takes control', async ({ page }) => {
  await page.goto('/');
  await waitForController(page);

  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.scope ?? null;
  });
  expect(scope).not.toBeNull();
});

// The point of the service worker: the game keeps working with no network.
test('plays offline once installed', async ({ page, context }) => {
  await page.goto('/');
  await waitForController(page);
  // Give the install handler time to finish filling the cache.
  await page.waitForTimeout(2000);

  await context.setOffline(true);
  try {
    await page.reload();

    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.__dodge !== undefined, null, { timeout: 20_000 });

    // Not just the shell — the game actually runs.
    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(async () => page.evaluate(() => window.__dodge?.snapshot().phase), { timeout: 20_000 })
      .toBe('playing');
  } finally {
    await context.setOffline(false);
  }
});
