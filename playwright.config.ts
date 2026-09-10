import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Some sandboxes ship a Chromium build that does not match this Playwright
 * version's expected revision. Point at it when it exists, and fall back to a
 * normal `playwright install` browser everywhere else (including CI).
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

export default defineConfig({
  testDir: './tests/e2e',
  // Several specs wait on real gameplay (surviving, then being hit), which
  // takes tens of seconds. The default 30s cap is shorter than those waits,
  // so they could only ever pass by luck.
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    launchOptions,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Bind IPv4 explicitly. `vite preview` defaults to `localhost`, which
    // resolves to ::1 on the CI runner while Playwright polls 127.0.0.1, so the
    // server came up and was never seen — the whole run timed out before a
    // single test started. It passed locally only because localhost resolves to
    // IPv4 there.
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    // Surface server output, so a failure like the above is diagnosable from
    // the CI log instead of a bare timeout.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
