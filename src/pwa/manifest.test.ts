import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PALETTE } from '../config.js';

interface Icon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Icon[];
};

/** Reads a PNG's width and height from its header. */
function pngSize(path: string): string {
  const header = readFileSync(path);
  expect(header.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${String(header.readUInt32BE(16))}x${String(header.readUInt32BE(20))}`;
}

describe('the web app manifest', () => {
  it('makes the game installable and full screen', () => {
    expect(manifest.name).toBe('Dodge Asteroid');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
  });

  // The site lives under a sub-path on GitHub Pages; absolute URLs would
  // install an app that opens on the wrong page.
  it('uses relative URLs, so it works from any sub-path', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);
  });

  it('launches on the game’s own background, not a white flash', () => {
    expect(manifest.background_color).toBe(PALETTE.background);
    expect(manifest.theme_color).toBe(PALETTE.background);
  });

  it('ships every icon it declares, at the size it declares', () => {
    for (const icon of manifest.icons) {
      const path = `public/${icon.src}`;
      expect(existsSync(path)).toBe(true);
      if (icon.type === 'image/png') expect(pngSize(path)).toBe(icon.sizes);
    }
  });

  it('includes the icons installers ask for', () => {
    const png = (size: string, purpose: string) =>
      manifest.icons.some((i) => i.sizes === size && i.purpose === purpose);
    expect(png('192x192', 'any')).toBe(true);
    expect(png('512x512', 'any')).toBe(true);
    expect(png('512x512', 'maskable')).toBe(true);
    expect(pngSize('public/icons/apple-touch-icon.png')).toBe('180x180');
  });
});

describe('the service worker template', () => {
  it('still has the placeholder the build fills in', () => {
    expect(readFileSync('pwa/service-worker.js', 'utf8')).toContain(
      '[/* filled in by the build */]',
    );
  });
});
