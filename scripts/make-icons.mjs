/**
 * Draws the app icons from one SVG, so the home-screen icon is the game's own
 * ship rather than a stock glyph, and regenerating them is one command:
 *   npm run icons
 *
 * Writes public/icons/: the SVG favicon, 192 and 512 PNGs, a maskable 512
 * (full bleed, with everything that matters inside the 80% safe circle
 * Android crops to), and a 180 apple-touch-icon.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/icons';
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : {};

/** The same hull the canvas draws, at r = 100 around the origin. */
const HULL = 'M0 -135 Q72 -10 102 72 Q40 42 0 60 Q-40 42 -102 72 Q-72 -10 0 -135 Z';

/**
 * @param {{ bleed: boolean }} options  `bleed` fills the square for maskable
 *   and apple icons; otherwise the art sits on a rounded tile.
 */
function svg({ bleed }) {
  // Maskable icons are cropped to a circle of 80% diameter, so the art shrinks.
  const art = bleed ? 0.8 : 1;
  const shape = bleed
    ? '<rect width="512" height="512"/>'
    : '<rect x="16" y="16" width="480" height="480" rx="112"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="sea" cx="40%" cy="25%" r="90%">
      <stop offset="0" stop-color="#0f4a57"/>
      <stop offset="0.55" stop-color="#072029"/>
      <stop offset="1" stop-color="#04141c"/>
    </radialGradient>
    <linearGradient id="hull" x1="0" y1="-135" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.45" stop-color="#7dffd8"/>
      <stop offset="1" stop-color="#12957a"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="50" x2="0" y2="230" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.35" stop-color="#2effc0"/>
      <stop offset="1" stop-color="#2effc0" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="tail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff5a86" stop-opacity="0"/>
      <stop offset="1" stop-color="#ff5a86"/>
    </linearGradient>
    <radialGradient id="rock" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffd0de"/>
      <stop offset="0.45" stop-color="#ff6f96"/>
      <stop offset="1" stop-color="#b3264f"/>
    </radialGradient>
    <clipPath id="tile">${shape}</clipPath>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g clip-path="url(#tile)">
  <rect width="512" height="512" fill="url(#sea)"/>
  <g transform="translate(256 256) scale(${art}) translate(-256 -256)">
    <g fill="#d2f5ef" opacity="0.7">
      <circle cx="120" cy="140" r="3"/><circle cx="390" cy="110" r="2.5"/>
      <circle cx="420" cy="300" r="3"/><circle cx="96" cy="350" r="2"/>
      <circle cx="300" cy="80" r="2"/>
    </g>
    <path d="M164 20 Q170 18 176 20 L206 168 Q173 186 140 168 Z" fill="url(#tail)" opacity="0.9"/>
    <circle cx="173" cy="172" r="36" fill="url(#rock)" stroke="#4d0a1f" stroke-width="7"/>
    <ellipse cx="182" cy="182" rx="10" ry="7" fill="#c93460" transform="rotate(-20 182 182)"/>
    <ellipse cx="160" cy="158" rx="11" ry="6" fill="#ffffff" opacity="0.45" transform="rotate(-35 160 158)"/>
    <g fill="#ffe7a3" stroke="#0b1f26" stroke-width="3" stroke-linejoin="round">
      <path d="M372 150 l11 -16 l11 16 l-11 16 Z"/>
      <path d="M352 194 l9 -13 l9 13 l-9 13 Z"/>
    </g>
    <g transform="translate(276 288) rotate(-14) scale(0.95)" filter="url(#glow)">
      <path d="M-42 50 Q-20 200 0 200 Q20 200 42 50 Z" fill="url(#flame)"/>
      <path d="${HULL}" fill="url(#hull)" stroke="#063a30" stroke-width="13" stroke-linejoin="round"/>
      <ellipse cx="0" cy="-34" rx="30" ry="44" fill="#05282a"/>
      <ellipse cx="-9" cy="-46" rx="13" ry="20" fill="#e2fff7" opacity="0.6" transform="rotate(-23 -9 -46)"/>
    </g>
  </g>
  </g>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/icon.svg`, svg({ bleed: false }));

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();
const render = async (file, size, bleed) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${String(size)}px;height:${String(size)}px}</style>${svg({ bleed })}`,
  );
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: !bleed });
};

await render('icon-192.png', 192, false);
await render('icon-512.png', 512, false);
await render('maskable-512.png', 512, true);
await render('apple-touch-icon.png', 180, true);
await browser.close();
console.log(`wrote icons to ${OUT}`);
