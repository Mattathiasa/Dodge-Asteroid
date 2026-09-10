/**
 * Renders the app icons from one inline SVG.
 *
 * Icons are generated rather than checked in as art so the repository keeps no
 * binary source assets, and so the icon cannot drift from the game's palette:
 * the colours below are the ember meteor's, straight out of src/render/meteors.ts.
 *
 *   node scripts/generate-icons.mjs public
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'public';
mkdirSync(OUT, { recursive: true });

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

/**
 * @param {number} size
 * @param {boolean} maskable Maskable icons need their art inside a safe circle,
 *   because the launcher may crop the corners to any shape.
 */
function svg(size, maskable) {
  const pad = maskable ? 0.18 : 0.06;
  const s = 512;
  const inset = s * pad;
  const box = s - inset * 2;
  const cx = s / 2;
  const rockR = box * 0.23;
  const rockY = s * 0.68;
  // The flame tapers to a point just inside the top padding, so it reads as a
  // tail rather than being cropped square by the icon edge.
  const tailTop = inset + s * 0.01;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#241350"/><stop offset="1" stop-color="#0a0620"/>
    </linearGradient>
    <linearGradient id="tail" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ff5f1a" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#ff5f1a" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fff1a8"/>
    </linearGradient>
    <radialGradient id="rock" cx="0.34" cy="0.3" r="0.82">
      <stop offset="0" stop-color="#ffc46b"/><stop offset="0.5" stop-color="#f2792a"/>
      <stop offset="1" stop-color="#a8330d"/>
    </radialGradient>
  </defs>

  <rect width="${s}" height="${s}" ${maskable ? '' : `rx="${s * 0.2}"`} fill="url(#bg)"/>

  <g fill="#b9c0ff">
    <circle cx="${s * 0.2}" cy="${s * 0.22}" r="4" opacity="0.6"/>
    <circle cx="${s * 0.79}" cy="${s * 0.3}" r="5" opacity="0.5"/>
    <circle cx="${s * 0.72}" cy="${s * 0.14}" r="3.5" opacity="0.45"/>
    <circle cx="${s * 0.26}" cy="${s * 0.8}" r="4" opacity="0.4"/>
  </g>

  <path d="M${cx - rockR} ${rockY - rockR * 0.15}
           C${cx - rockR * 1.05} ${rockY - (rockY - tailTop) * 0.45} ${cx - rockR * 0.42} ${rockY - (rockY - tailTop) * 0.8} ${cx} ${tailTop}
           C${cx + rockR * 0.42} ${rockY - (rockY - tailTop) * 0.8} ${cx + rockR * 1.05} ${rockY - (rockY - tailTop) * 0.45} ${cx + rockR} ${rockY - rockR * 0.15} Z"
        fill="url(#tail)"/>
  <path d="M${cx - rockR * 0.46} ${rockY - rockR * 0.1}
           C${cx - rockR * 0.5} ${rockY - (rockY - tailTop) * 0.4} ${cx - rockR * 0.2} ${rockY - (rockY - tailTop) * 0.62} ${cx} ${tailTop + (rockY - tailTop) * 0.3}
           C${cx + rockR * 0.2} ${rockY - (rockY - tailTop) * 0.62} ${cx + rockR * 0.5} ${rockY - (rockY - tailTop) * 0.4} ${cx + rockR * 0.46} ${rockY - rockR * 0.1} Z"
        fill="#fff1a8" opacity="0.92"/>

  <circle cx="${cx}" cy="${rockY}" r="${rockR}" fill="url(#rock)" stroke="#1b0b36" stroke-width="${s * 0.035}"/>
  <ellipse cx="${cx - rockR * 0.34}" cy="${rockY - rockR * 0.18}" rx="${rockR * 0.29}" ry="${rockR * 0.22}" fill="#a8330d" opacity="0.85"/>
  <ellipse cx="${cx + rockR * 0.36}" cy="${rockY + rockR * 0.3}" rx="${rockR * 0.21}" ry="${rockR * 0.16}" fill="#a8330d" opacity="0.8"/>
  <ellipse cx="${cx - rockR * 0.36}" cy="${rockY - rockR * 0.42}" rx="${rockR * 0.3}" ry="${rockR * 0.15}" fill="#ffffff" opacity="0.34" transform="rotate(-32 ${cx - rockR * 0.36} ${rockY - rockR * 0.42})"/>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();

for (const { file, size, maskable } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${svg(size, maskable)}`,
  );
  await page.locator('svg').screenshot({ path: `${OUT}/${file}`, omitBackground: true });
  console.log(`${OUT}/${file} (${size}px${maskable ? ', maskable' : ''})`);
}

await browser.close();
