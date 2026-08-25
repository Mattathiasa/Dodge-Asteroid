const pptx = require('pptxgenjs');
const p = new pptx();
p.layout = 'LAYOUT_WIDE';
const W = 13.3;

const INK = '150A35',
  DEEP = '0A0620',
  CREAM = 'FFF3DC';
const EMBER = 'F2792A',
  ROSE = 'FF5FB4',
  CYAN = '4FF0FF',
  GREEN = '8FCF2F',
  MUTED = 'B6A7D6',
  SLATE = '4A3A66';
const HEAD = 'Arial',
  BODY = 'Calibri';
// Reads the media produced by capture-media.mjs and capture-store.mjs.
const SHOT = (f) => `${process.cwd()}/docs/${f}`;

const dark = () => {
  const s = p.addSlide();
  s.background = { color: INK };
  return s;
};
const light = () => {
  const s = p.addSlide();
  s.background = { color: CREAM };
  return s;
};
const meteor = (s, x, y, r, color) =>
  s.addShape(p.ShapeType.ellipse, {
    x: x - r,
    y: y - r,
    w: r * 2,
    h: r * 2,
    fill: { color },
    line: { color: DEEP, width: 2 },
  });
const title = (s, t, c) =>
  s.addText(t, {
    x: 0.8,
    y: 0.45,
    w: W - 1.6,
    h: 0.9,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: c,
    margin: 0,
  });

/* 1 — title */
{
  const s = dark();
  meteor(s, 11.8, 1.7, 0.5, ROSE);
  meteor(s, 12.6, 3.3, 0.28, CYAN);
  meteor(s, 11.1, 4.5, 0.2, GREEN);
  s.addText('Choosing a look', {
    x: 0.9,
    y: 2.2,
    w: 9.5,
    h: 1.2,
    fontFace: HEAD,
    fontSize: 54,
    bold: true,
    color: CREAM,
    margin: 0,
  });
  s.addText('Three directions for the Dodge Asteroid interface', {
    x: 0.9,
    y: 3.5,
    w: 9.5,
    h: 0.6,
    fontFace: BODY,
    fontSize: 20,
    color: MUTED,
    margin: 0,
  });
  s.addNotes(
    'The first pass was competent and completely generic. These are three ways out of that, on genuinely different axes.',
  );
}

/* 2 — the problem */
{
  const s = light();
  title(s, 'The first pass was the problem', INK);
  s.addText(
    'Neon cyan on near-black. It is the default setting for every space game, which is exactly why it reads as nothing in particular.',
    { x: 0.8, y: 1.4, w: 6.4, h: 1.1, fontFace: BODY, fontSize: 17, color: SLATE, margin: 0 },
  );
  s.addText('The art had already solved it', {
    x: 0.8,
    y: 2.9,
    w: 6.4,
    h: 0.5,
    fontFace: HEAD,
    fontSize: 18,
    bold: true,
    color: EMBER,
    margin: 0,
  });
  s.addText(
    'The meteors are drawn as glossy rocks with thick dark outlines. The chrome was ignoring that language entirely, so the interface and the art looked like two different products.',
    { x: 0.8, y: 3.5, w: 6.4, h: 1.4, fontFace: BODY, fontSize: 15, color: SLATE, margin: 0 },
  );
  s.addText('Brief: make it read as a polished arcade game, not a code demo.', {
    x: 0.8,
    y: 5.3,
    w: 6.4,
    h: 0.8,
    fontFace: BODY,
    fontSize: 15,
    italic: true,
    bold: true,
    color: INK,
    margin: 0,
  });
  s.addImage({ path: SHOT('gameplay.png'), x: 7.9, y: 1.4, h: 5.3, w: 4.6 });
  s.addNotes('The meteors were already right. The chrome had to join them.');
}

/* 3 — A */
{
  const s = light();
  title(s, 'A — Sticker Arcade', INK);
  s.addShape(p.ShapeType.roundRect, {
    x: 0.8,
    y: 1.35,
    w: 2.0,
    h: 0.42,
    fill: { color: EMBER },
    line: { color: INK, width: 2 },
    rectRadius: 0.1,
  });
  s.addText('CHOSEN', {
    x: 0.8,
    y: 1.35,
    w: 2.0,
    h: 0.42,
    fontFace: HEAD,
    fontSize: 12,
    bold: true,
    color: CREAM,
    align: 'center',
    margin: 0,
  });
  s.addText(
    'Ink outlines, warm cream panels, hard offset shadows so controls have visible thickness and a real press. Cream on deep purple, rather than more neon on black.',
    { x: 0.8, y: 2.0, w: 6.3, h: 1.3, fontFace: BODY, fontSize: 16, color: SLATE, margin: 0 },
  );
  s.addText('Why it wins', {
    x: 0.8,
    y: 3.5,
    w: 6.3,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: GREEN,
    margin: 0,
  });
  s.addText(
    'It speaks the meteors’ own language, so the chrome and the art become one piece instead of two competing ones.',
    { x: 0.8, y: 3.95, w: 6.3, h: 0.9, fontFace: BODY, fontSize: 14, color: SLATE, margin: 0 },
  );
  s.addText('The tradeoff', {
    x: 0.8,
    y: 5.0,
    w: 6.3,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: ROSE,
    margin: 0,
  });
  s.addText(
    'Warm and playful sets a tone. It would be the wrong choice for something that wanted to read as serious or technical.',
    { x: 0.8, y: 5.45, w: 6.3, h: 0.9, fontFace: BODY, fontSize: 14, color: SLATE, margin: 0 },
  );
  s.addImage({ path: SHOT('menu.png'), x: 7.9, y: 1.35, h: 5.4, w: 3.36 });
  s.addNotes(
    'Chosen and shipped. The logo is stroked with paint-order rather than stacked shadows, which ghost into a doubled word.',
  );
}

/* 4 — B and C */
{
  const s = dark();
  title(s, 'The two it beat', CREAM);
  const alts = [
    [
      'B — Arcade cabinet',
      'Phosphor green, scanlines, a bezel, pixel type, "insert coin".',
      'Strong identity, and it leans into the 1979 heritage.',
      'The nostalgia does most of the work, and it dates the piece on purpose.',
      GREEN,
    ],
    [
      'C — Instrument',
      'Thin rules, orbital telemetry, one hot accent, technical type.',
      'Sleek and grown-up; the most restrained of the three.',
      'Closest to the original problem — quiet reads as generic.',
      CYAN,
    ],
  ];
  alts.forEach(([name, what, up, down, c], i) => {
    const x = 0.8 + i * 6.1;
    s.addShape(p.ShapeType.roundRect, {
      x,
      y: 1.45,
      w: 5.7,
      h: 4.9,
      fill: { color: DEEP },
      line: { color: c, width: 2 },
      rectRadius: 0.12,
    });
    s.addText(name, {
      x: x + 0.35,
      y: 1.75,
      w: 5.0,
      h: 0.45,
      fontFace: HEAD,
      fontSize: 20,
      bold: true,
      color: c,
      margin: 0,
    });
    s.addText(what, {
      x: x + 0.35,
      y: 2.3,
      w: 5.0,
      h: 0.8,
      fontFace: BODY,
      fontSize: 14,
      color: CREAM,
      margin: 0,
    });
    s.addText('For', {
      x: x + 0.35,
      y: 3.25,
      w: 5.0,
      h: 0.32,
      fontFace: HEAD,
      fontSize: 12,
      bold: true,
      color: MUTED,
      margin: 0,
    });
    s.addText(up, {
      x: x + 0.35,
      y: 3.6,
      w: 5.0,
      h: 0.75,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
    });
    s.addText('Against', {
      x: x + 0.35,
      y: 4.5,
      w: 5.0,
      h: 0.32,
      fontFace: HEAD,
      fontSize: 12,
      bold: true,
      color: ROSE,
      margin: 0,
    });
    s.addText(down, {
      x: x + 0.35,
      y: 4.85,
      w: 5.0,
      h: 0.9,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      margin: 0,
    });
  });
  s.addText(
    'Both were kept deliberately low-fidelity. They existed to make the choice real, not to be finished work.',
    {
      x: 0.8,
      y: 6.55,
      w: 11.7,
      h: 0.5,
      fontFace: BODY,
      fontSize: 13,
      italic: true,
      color: SLATE,
      margin: 0,
    },
  );
  s.addNotes(
    'Offering only one polished option and two throwaways would have been a rigged vote, so each got an honest case and an honest cost.',
  );
}

/* 5 — what shipped */
{
  const s = light();
  title(s, 'What shipped', INK);
  s.addImage({ path: SHOT('store/store-1.png'), x: 0.8, y: 1.35, h: 5.4, w: 3.04 });
  s.addImage({ path: SHOT('store/store-3.png'), x: 4.1, y: 1.35, h: 5.4, w: 3.04 });
  const notes = [
    ['Chrome matches the art', 'Ink outlines and cream panels, the same language as the meteors.'],
    ['Buttons have thickness', 'An offset lower layer the press sinks into, not a flat rectangle.'],
    [
      'The frame is the play field',
      'Fitted in JS, because a percentage max-height leaves dead bands on tall phones.',
    ],
    ['The title screen plays itself', 'Meteors drift behind the menu using the real spawner.'],
  ];
  notes.forEach(([h, d], i) => {
    const y = 1.6 + i * 1.3;
    s.addShape(p.ShapeType.ellipse, {
      x: 7.6,
      y: y + 0.04,
      w: 0.3,
      h: 0.3,
      fill: { color: [EMBER, ROSE, CYAN, GREEN][i] },
      line: { color: INK, width: 2 },
    });
    s.addText(h, {
      x: 8.1,
      y,
      w: 4.4,
      h: 0.38,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: INK,
      margin: 0,
    });
    s.addText(d, {
      x: 8.1,
      y: y + 0.4,
      w: 4.4,
      h: 0.75,
      fontFace: BODY,
      fontSize: 12,
      color: SLATE,
      margin: 0,
    });
  });
  s.addNotes(
    'The store cards are generated by a script that plays the game, so they cannot drift from the build.',
  );
}

p.writeFile({ fileName: 'docs/decks/Dodge-Asteroid-Design-Directions.pptx' }).then(() =>
  console.log('directions written'),
);
