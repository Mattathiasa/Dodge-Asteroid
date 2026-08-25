const pptx = require('pptxgenjs');
const p = new pptx();
p.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5
const W = 13.3;

// Palette lifted from the game itself.
const INK = '150A35',
  DEEP = '0A0620',
  CREAM = 'FFF3DC',
  CREAM2 = 'F6E6C8';
const EMBER = 'F2792A',
  ROSE = 'FF5FB4',
  CYAN = '4FF0FF',
  GREEN = '8FCF2F',
  MUTED = 'B6A7D6';
const SLATE = '4A3A66';

const HEAD = 'Arial',
  BODY = 'Calibri';
const IMG = (f) => `${process.cwd()}/docs/${f}`;

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

// Repeated motif: a meteor dot with a soft ring.
function meteor(s, x, y, r, color) {
  s.addShape(p.ShapeType.ellipse, {
    x: x - r,
    y: y - r,
    w: r * 2,
    h: r * 2,
    fill: { color },
    line: { color: DEEP, width: 2 },
  });
}

function title(s, text, color) {
  s.addText(text, {
    x: 0.8,
    y: 0.45,
    w: W - 1.6,
    h: 0.9,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color,
    margin: 0,
  });
}

/* 1 — title */
{
  const s = dark();
  meteor(s, 11.6, 1.5, 0.55, EMBER);
  meteor(s, 12.5, 3.0, 0.3, ROSE);
  meteor(s, 10.9, 4.3, 0.22, GREEN);
  s.addText('Dodge Asteroid', {
    x: 0.9,
    y: 2.1,
    w: 9,
    h: 1.3,
    fontFace: HEAD,
    fontSize: 60,
    bold: true,
    color: CREAM,
    margin: 0,
  });
  s.addText('Rebuilding a broken hobby game into something worth shipping', {
    x: 0.9,
    y: 3.5,
    w: 9,
    h: 0.7,
    fontFace: BODY,
    fontSize: 20,
    color: MUTED,
    margin: 0,
  });
  s.addText('TypeScript  ·  Canvas 2D  ·  zero runtime dependencies', {
    x: 0.9,
    y: 4.5,
    w: 9,
    h: 0.5,
    fontFace: BODY,
    fontSize: 15,
    bold: true,
    color: EMBER,
    margin: 0,
  });
  s.addText('mattathiasa.github.io/Dodge-Asteroid', {
    x: 0.9,
    y: 6.4,
    w: 9,
    h: 0.4,
    fontFace: BODY,
    fontSize: 13,
    color: SLATE,
    margin: 0,
  });
  s.addNotes(
    'The project started as a jQuery prototype that did not work. This deck covers what was wrong, what I rebuilt, and what the result measures.',
  );
}

/* 2 — the starting point */
{
  const s = light();
  title(s, 'The starting point', INK);
  s.addText(
    '431 lines of jQuery, uploaded through the GitHub web UI in three commits all named "Add files via upload". It looked finished. It was not.',
    { x: 0.8, y: 1.4, w: 7.1, h: 1.2, fontFace: BODY, fontSize: 17, color: SLATE, margin: 0 },
  );

  const stats = [
    ['2', 'functions called but never defined', ROSE],
    ['0', 'tests, CI, README or licence', EMBER],
    ['86 KB', 'of vendored jQuery, three CVEs', GREEN],
    ['~30 s', 'until the game became unplayable', CYAN],
  ];
  stats.forEach(([big, label, c], i) => {
    const y = 2.9 + Math.floor(i / 2) * 1.9,
      x = 0.8 + (i % 2) * 3.6;
    s.addShape(p.ShapeType.roundRect, {
      x,
      y,
      w: 3.3,
      h: 1.55,
      fill: { color: CREAM2 },
      line: { color: INK, width: 2 },
      rectRadius: 0.12,
    });
    s.addText(big, {
      x: x + 0.25,
      y: y + 0.18,
      w: 2.8,
      h: 0.7,
      fontFace: HEAD,
      fontSize: 30,
      bold: true,
      color: c,
      margin: 0,
    });
    s.addText(label, {
      x: x + 0.25,
      y: y + 0.88,
      w: 2.85,
      h: 0.55,
      fontFace: BODY,
      fontSize: 12,
      color: SLATE,
      margin: 0,
    });
  });

  s.addImage({ path: IMG('store/store-2.png'), x: 8.6, y: 1.4, h: 5.4, w: 3.04 });
  s.addNotes(
    'Three commits, no history worth reading, and several code paths that threw at runtime.',
  );
}

/* 3 — what was actually broken */
{
  const s = light();
  title(s, 'What was actually broken', INK);
  const rows = [
    [
      'pauseGame  ·  animateAsteroids',
      'Called but never defined. The first threw during ready() and aborted the bindings after it; the second left Resume permanently broken.',
    ],
    [
      'isColliding()',
      'Ended in a bare return, so it always read false and gameOver() was unreachable. Game over was a blocking alert() fired from inside the collision test.',
    ],
    [
      'setInterval per asteroid',
      'A new timer created on every spawn, never cleared, assigning to the wrong this. A leak that did nothing.',
    ],
    [
      'speed /= 1.09 per spawn',
      'Compounding with no upper bound. Mathematically unplayable about thirty seconds in.',
    ],
  ];
  rows.forEach(([code, desc], i) => {
    const y = 1.45 + i * 1.35;
    meteor(s, 1.05, y + 0.42, 0.17, [ROSE, EMBER, CYAN, GREEN][i]);
    s.addText(code, {
      x: 1.45,
      y,
      w: 4.3,
      h: 0.45,
      fontFace: 'Courier New',
      fontSize: 14,
      bold: true,
      color: INK,
      margin: 0,
    });
    s.addText(desc, {
      x: 1.45,
      y: y + 0.42,
      w: 10.7,
      h: 0.85,
      fontFace: BODY,
      fontSize: 13,
      color: SLATE,
      margin: 0,
    });
  });
  s.addNotes('Every one of these is quoted from the original source, not inferred.');
}

/* 4 — architecture */
{
  const s = light();
  title(s, 'One rule holds the design up', INK);
  s.addText('core/ and game/ never import from render/, input/, audio/ or the DOM.', {
    x: 0.8,
    y: 1.35,
    w: 11.7,
    h: 0.5,
    fontFace: BODY,
    fontSize: 18,
    bold: true,
    color: EMBER,
    margin: 0,
  });

  const layers = [
    ['core/', 'seeded RNG · math · viewport geometry', CYAN],
    ['game/', 'phases · loop · collision · difficulty · spawning · scoring', GREEN],
    ['render/ input/ audio/ ui/ storage/', 'the browser lives only out here', ROSE],
  ];
  layers.forEach(([name, desc, c], i) => {
    const y = 2.2 + i * 1.15;
    s.addShape(p.ShapeType.roundRect, {
      x: 0.8,
      y,
      w: 7.4,
      h: 0.95,
      fill: { color: CREAM2 },
      line: { color: INK, width: 2 },
      rectRadius: 0.1,
    });
    s.addShape(p.ShapeType.ellipse, {
      x: 1.0,
      y: y + 0.26,
      w: 0.42,
      h: 0.42,
      fill: { color: c },
      line: { color: INK, width: 2 },
    });
    s.addText(name, {
      x: 1.6,
      y: y + 0.13,
      w: 6.3,
      h: 0.36,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: INK,
      margin: 0,
    });
    s.addText(desc, {
      x: 1.6,
      y: y + 0.5,
      w: 6.4,
      h: 0.36,
      fontFace: BODY,
      fontSize: 12,
      color: SLATE,
      margin: 0,
    });
  });

  const wins = [
    'Runs are reproducible — a run is a pure function of its seed',
    'Side effects are reported, not performed — the sim emits events',
    'The loop is testable — fixed timestep, injectable clock',
  ];
  s.addText('Three things follow', {
    x: 8.6,
    y: 2.2,
    w: 3.9,
    h: 0.4,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: INK,
    margin: 0,
  });
  s.addText(
    wins.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < wins.length - 1 } })),
    {
      x: 8.6,
      y: 2.7,
      w: 3.9,
      h: 2.3,
      fontFace: BODY,
      fontSize: 13,
      color: SLATE,
      paraSpaceAfter: 10,
      margin: 0,
    },
  );
  s.addNotes('That single rule is what makes the whole simulation headless-testable.');
}

/* 5 — difficulty chart */
{
  const s = light();
  title(s, 'The curve that broke the game', INK);
  s.addText(
    'The original multiplied fall speed by a constant on every spawn, with no cap. The rewrite is a bounded smoothstep ramp: gentle, then steep, then flat.',
    { x: 0.8, y: 1.3, w: 11.7, h: 0.7, fontFace: BODY, fontSize: 15, color: SLATE, margin: 0 },
  );

  const labels = [],
    oldS = [],
    newS = [];
  const smooth = (x) => {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
  };
  for (let t = 0; t <= 40; t += 2) {
    labels.push(String(t));
    oldS.push(Math.round(360 * Math.pow(1.09, t))); // 720px field / (2 / 1.09^spawns)
    const i = smooth((t - 2) / 120);
    newS.push(Math.round(170 + (420 - 170) * i));
  }
  s.addChart(
    'line',
    [
      { name: 'Original', labels, values: oldS },
      { name: 'Rewrite', labels, values: newS },
    ],
    {
      x: 0.8,
      y: 2.15,
      w: 11.7,
      h: 4.6,
      chartColors: [ROSE, GREEN],
      lineSize: 3,
      showTitle: true,
      title: 'Asteroid fall speed (px/s) by seconds survived',
      titleColor: INK,
      titleFontSize: 13,
      titleFontFace: BODY,
      showLegend: true,
      legendPos: 't',
      legendColor: SLATE,
      legendFontSize: 12,
      catAxisLabelColor: SLATE,
      valAxisLabelColor: SLATE,
      catAxisLabelFontSize: 10,
      valAxisLabelFontSize: 10,
      valGridLine: { color: 'DDD2BC', size: 1 },
      catGridLine: { style: 'none' },
    },
  );
  s.addNotes(
    'The original line leaves the chart. The rewrite plateaus by design and is hard-capped so nothing can outrun continuous collision detection.',
  );
}

/* 6 — testing */
{
  const s = dark();
  title(s, "What is tested — and what isn't", CREAM);
  s.addText(
    'The simulation is a pure function of its seed, its input and its timestep. That is what the tests cover.',
    { x: 0.8, y: 1.35, w: 11.7, h: 0.5, fontFace: BODY, fontSize: 16, color: MUTED, margin: 0 },
  );

  const cards = [
    [
      '153',
      'unit tests',
      'difficulty · collision · scoring · spawning · phases · loop · pools · storage',
      CYAN,
    ],
    ['12', 'end-to-end specs', 'the real built game in Chromium and on an emulated phone', GREEN],
    [
      '60 s',
      'simulated per run test',
      'played twice, asserted identical — that is how frame-rate independence is proved',
      EMBER,
    ],
  ];
  cards.forEach(([big, small, desc, c], i) => {
    const x = 0.8 + i * 4.0;
    s.addShape(p.ShapeType.roundRect, {
      x,
      y: 2.3,
      w: 3.7,
      h: 3.2,
      fill: { color: DEEP },
      line: { color: c, width: 2 },
      rectRadius: 0.12,
    });
    s.addText(big, {
      x: x + 0.3,
      y: 2.55,
      w: 3.1,
      h: 0.9,
      fontFace: HEAD,
      fontSize: 40,
      bold: true,
      color: c,
      margin: 0,
    });
    s.addText(small, {
      x: x + 0.3,
      y: 3.45,
      w: 3.1,
      h: 0.4,
      fontFace: HEAD,
      fontSize: 14,
      bold: true,
      color: CREAM,
      margin: 0,
    });
    s.addText(desc, {
      x: x + 0.3,
      y: 3.95,
      w: 3.1,
      h: 1.4,
      fontFace: BODY,
      fontSize: 12,
      color: MUTED,
      margin: 0,
    });
  });
  s.addText(
    'Canvas draw calls and WebAudio graphs are not unit-tested. Asserting that ctx.arc ran 22 times is a test that only breaks when the visuals improve.',
    {
      x: 0.8,
      y: 5.9,
      w: 11.7,
      h: 0.6,
      fontFace: BODY,
      fontSize: 13,
      italic: true,
      color: SLATE,
      margin: 0,
    },
  );
  s.addNotes(
    'Deliberate, stated scope reads as judgement. Chasing 100% coverage on a renderer does not.',
  );
}

/* 7 — before / after */
{
  const s = light();
  title(s, 'Before and after', INK);
  const rows = [
    ['Runtime dependencies', 'jQuery 3.3.1, 86 KB, 3 CVEs', 'None'],
    ['Bundle', 'n/a', '37 KB · 13 KB gzipped'],
    ['Tests', 'None', '153 unit · 12 end-to-end'],
    ['CI', 'None', 'Typecheck, lint, format, test, build, deploy'],
    ['Input', 'Mouse only', 'Mouse, touch and keyboard'],
    ['Game over', 'Blocking alert(), stacked', 'In-page screen with a local leaderboard'],
  ];
  rows.forEach(([label, before, after], i) => {
    const y = 1.5 + i * 0.88;
    s.addText(label, {
      x: 0.8,
      y,
      w: 3.2,
      h: 0.5,
      fontFace: HEAD,
      fontSize: 13,
      bold: true,
      color: INK,
      margin: 0,
    });
    s.addText(before, {
      x: 4.1,
      y,
      w: 3.9,
      h: 0.5,
      fontFace: BODY,
      fontSize: 13,
      color: SLATE,
      margin: 0,
    });
    s.addShape(p.ShapeType.ellipse, {
      x: 8.15,
      y: y + 0.14,
      w: 0.2,
      h: 0.2,
      fill: { color: EMBER },
      line: { color: INK, width: 1 },
    });
    s.addText(after, {
      x: 8.55,
      y,
      w: 4.0,
      h: 0.5,
      fontFace: BODY,
      fontSize: 13,
      bold: true,
      color: INK,
      margin: 0,
    });
  });
  s.addNotes('Every number here is measured from the repository, not estimated.');
}

/* 8 — the game */
{
  const s = dark();
  title(s, 'The result', CREAM);
  s.addImage({ path: IMG('menu.png'), x: 0.8, y: 1.4, h: 5.3, w: 3.68 });
  s.addImage({ path: IMG('gameplay.png'), x: 4.9, y: 1.4, h: 5.3, w: 3.68 });
  s.addText(
    [
      {
        text: 'Survival scoring with near-miss combos',
        options: { bullet: true, breakLine: true },
      },
      {
        text: 'Shield, slow-motion and extra-life pickups',
        options: { bullet: true, breakLine: true },
      },
      {
        text: 'Three difficulties and a local leaderboard',
        options: { bullet: true, breakLine: true },
      },
      {
        text: 'Reduced motion, ARIA announcements, focusable controls',
        options: { bullet: true, breakLine: true },
      },
      { text: 'Sound synthesised at runtime — no binary assets', options: { bullet: true } },
    ],
    {
      x: 9.1,
      y: 1.9,
      w: 3.5,
      h: 3.6,
      fontFace: BODY,
      fontSize: 13,
      color: MUTED,
      paraSpaceAfter: 12,
      margin: 0,
    },
  );
  s.addNotes(
    'The screenshots are generated by a script that plays the game, so they cannot drift from the code.',
  );
}

/* 9 — close */
{
  const s = dark();
  meteor(s, 1.7, 5.6, 0.5, GREEN);
  meteor(s, 2.9, 6.3, 0.26, CYAN);
  s.addText('Play it', {
    x: 0.9,
    y: 2.2,
    w: 11,
    h: 1.0,
    fontFace: HEAD,
    fontSize: 46,
    bold: true,
    color: CREAM,
    margin: 0,
  });
  s.addText('mattathiasa.github.io/Dodge-Asteroid', {
    x: 0.9,
    y: 3.3,
    w: 11,
    h: 0.6,
    fontFace: BODY,
    fontSize: 22,
    color: EMBER,
    margin: 0,
  });
  s.addText('Source: github.com/Mattathiasa/Dodge-Asteroid', {
    x: 0.9,
    y: 4.1,
    w: 11,
    h: 0.5,
    fontFace: BODY,
    fontSize: 15,
    color: MUTED,
    margin: 0,
  });
  s.addNotes('Built by Mattathias Abraham.');
}

p.writeFile({ fileName: 'docs/decks/Dodge-Asteroid-Case-Study.pptx' }).then(() =>
  console.log('case study written'),
);
