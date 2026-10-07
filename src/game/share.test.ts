import { describe, expect, it } from 'vitest';
import { sectorStrip, shareText } from './share.js';

const URL = 'https://mattathiasa.github.io/Dodge-Asteroid/';

describe('sectorStrip', () => {
  it('colours each sector reached and darkens the rest', () => {
    expect(sectorStrip(0)).toBe('🟦⬛⬛⬛⬛⬛');
    expect(sectorStrip(3)).toBe('🟦🟧🟨🟩⬛⬛');
    expect(sectorStrip(5)).toBe('🟦🟧🟨🟩🟪🟥');
  });

  it('counts sectors past the sixth instead of growing the row', () => {
    expect(sectorStrip(6)).toBe('🟦🟧🟨🟩🟪🟥 +1');
    expect(sectorStrip(11)).toBe('🟦🟧🟨🟩🟪🟥 +6');
  });

  it('treats nonsense as the first sector', () => {
    expect(sectorStrip(-2)).toBe('🟦⬛⬛⬛⬛⬛');
  });
});

describe('shareText', () => {
  it('formats a daily result', () => {
    expect(
      shareText({
        score: 3840,
        sector: 3,
        bestCombo: 11,
        daily: { number: 12, attempts: 3 },
        url: URL,
      }),
    ).toBe(
      ['Dodge Asteroid · Daily #12', '🟦🟧🟨🟩⬛⬛', '3,840 pts · ×11 combo · 3 tries', URL].join(
        '\n',
      ),
    );
  });

  it('says "try" for a first attempt and leaves out an empty combo', () => {
    const text = shareText({
      score: 95,
      sector: 0,
      bestCombo: 1,
      daily: { number: 1, attempts: 1 },
      url: URL,
    });
    expect(text).toContain('95 pts · 1 try');
    expect(text).not.toContain('combo');
  });

  it('formats an endless result without daily details', () => {
    const text = shareText({ score: 2100, sector: 2, bestCombo: 6, url: URL });
    expect(text.split('\n')[0]).toBe('Dodge Asteroid');
    expect(text).toContain('2,100 pts · ×6 combo');
    expect(text).not.toContain('tries');
    expect(text.endsWith(URL)).toBe(true);
  });
});
