// Sternenkarte im Retro-Stil, nachempfunden der Karte des Grenzgebiets.
// Koordinaten entsprechen grob der Vorlage (Sol liegt links unten außerhalb).

import { el, txt, rng, smooth } from './svg.js';

export const SOL = { x: -13, y: 640 };
const R_CORE = 300;
const R_VEIL = 362;
const R_RIM = 550;
const R_EDGE = 592;
const BOUNDS = { x: -1300, y: -900, w: 2900, h: 2500 };

const circlePath = (c, r) => `M${c.x - r} ${c.y} A${r} ${r} 0 1 0 ${c.x + r} ${c.y} A${r} ${r} 0 1 0 ${c.x - r} ${c.y} Z`;
const ringPath = (c, r1, r2) => `${circlePath(c, r2)} ${circlePath(c, r1)}`;
const polar = (c, r, deg) => ({ x: c.x + r * Math.cos((deg * Math.PI) / 180), y: c.y + r * Math.sin((deg * Math.PI) / 180) });

function arcPath(c, r, a1, a2) {
  const p1 = polar(c, r, a1);
  const p2 = polar(c, r, a2);
  return `M${p1.x} ${p1.y} A${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

function sparkle(x, y, s) {
  const k = s * 0.22;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

function patterns(defs) {
  const dots = el('pattern', { id: 'pt-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 4, cy: 4, r: 1.4, class: 'sm-dotfill' }, dots);
  const stripes = el('pattern', { id: 'pt-stripes', width: 10, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { x: 0, y: 0, width: 10, height: 2.4, class: 'sm-stripefill' }, stripes);
  const hatch = el('pattern', { id: 'pt-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { x: 0, y: 0, width: 2, height: 7, class: 'sm-hatchfill' }, hatch);
  const clip = el('clipPath', { id: 'outside-veil' }, defs);
  el('path', {
    d: `M${BOUNDS.x} ${BOUNDS.y} H${BOUNDS.x + BOUNDS.w} V${BOUNDS.y + BOUNDS.h} H${BOUNDS.x} Z ${circlePath(SOL, R_VEIL)}`,
    'clip-rule': 'evenodd',
  }, clip);
}

export function drawStarmap(g, cfg) {
  const r = rng(282);
  const defs = el('defs', {}, g);
  patterns(defs);
  const world = el('g', {}, g);

  // Grenzgebiet (schraffiert)
  el('path', { d: ringPath(SOL, R_RIM, R_EDGE), class: 'sm-frontier', 'fill-rule': 'evenodd' }, world);
  el('path', { d: smooth([[640, 520], [690, 498], [750, 505], [775, 530], [740, 560], [680, 562], [645, 548]]), class: 'sm-frontier' }, world);
  el('path', { d: smooth([[420, 20], [520, -10], [600, 30], [575, 80], [500, 70], [450, 90]]), class: 'sm-frontier' }, world);

  // United Americas (gestreift)
  el('path', { d: ringPath(SOL, R_CORE, R_RIM), class: 'sm-ua', 'fill-rule': 'evenodd' }, world);

  // UPP (flächig) – großes Gebiet oben links und die Halbinsel entlang des Outer Veil
  el('path', {
    d: smooth([
      [-1300, -900], [560, -900], [560, -20], [470, 55], [410, 110], [330, 140], [250, 150], [212, 190], [222, 255],
      [258, 320], [296, 388], [322, 448], [342, 497], [360, 540], [376, 580], [398, 612], [404, 640], [382, 650],
      [358, 626], [338, 588], [318, 540], [300, 470], [150, 455], [-1300, 455],
    ], false),
    class: 'sm-upp',
    'clip-path': 'url(#outside-veil)',
  }, world);

  // Kernsysteme (Three World Empire) und unabhängige Kolonien (gepunktet)
  el('path', { d: circlePath(SOL, R_CORE), class: 'sm-twe' }, world);
  [
    [[-10, 610], [60, 590], [120, 615], [130, 665], [90, 710], [20, 715], [-30, 680]],
    [[205, 650], [228, 645], [235, 668], [214, 676]],
    [[232, 690], [255, 688], [258, 708], [236, 712]],
    [[240, 790], [280, 780], [295, 810], [265, 835], [238, 820]],
  ].forEach((pts) => el('path', { d: smooth(pts), class: 'sm-indep' }, world));

  // Raster und Spaltennummern
  const grid = el('g', { class: 'sm-grid' }, world);
  for (let x = 26 - 58.3 * 22; x < 1600; x += 58.3) el('line', { x1: x, y1: BOUNDS.y, x2: x, y2: BOUNDS.y + BOUNDS.h }, grid);
  for (let y = 30 - 58 * 16; y < 1600; y += 58) el('line', { x1: BOUNDS.x, y1: y, x2: BOUNDS.x + BOUNDS.w, y2: y }, grid);
  for (let n = 1; n <= 14; n++) txt(world, 55 + (n - 2) * 58.3, 610, String(n), 'sm-num', { 'text-anchor': 'middle' });

  // Ringe mit Beschriftung
  [R_VEIL - 4, R_VEIL + 4, R_RIM - 4, R_RIM + 4].forEach((rad) => el('path', { d: circlePath(SOL, rad), class: 'sm-ring' }, world));
  const arcs = [['arc-veil', R_VEIL + 12, -118, -40, 'OUTER VEIL'], ['arc-rim', R_RIM + 12, -112, -45, 'OUTER RIM TERRITORIES'], ['arc-core', R_CORE - 20, -160, -105, 'CORE SYSTEMS']];
  arcs.forEach(([id, rad, a1, a2, label]) => {
    el('path', { id, d: arcPath(SOL, rad, a1, a2), fill: 'none' }, defs);
    const t = el('text', { class: 'sm-arc' }, world);
    const tp = el('textPath', { href: `#${id}`, startOffset: '18%' }, t);
    tp.textContent = label;
  });

  // Sektorfelder: nur Borodino ist freigegeben
  [[40, 480, 150], [296, 332, 170], [575, 650, 160], [440, 732, 140], [228, 712, 120], [40, 620, 140]].forEach(([x, y, w]) => {
    el('rect', { x, y, width: w, height: 20, class: 'sm-box' }, world);
    txt(world, x + w / 2, y + 14, 'NO DATA', 'sm-box-t', { 'text-anchor': 'middle' });
  });
  el('rect', { x: 400, y: 562, width: 150, height: 22, class: 'sm-box hot' }, world);
  txt(world, 475, 577, cfg.sector, 'sm-box-t hot', { 'text-anchor': 'middle' });

  // Weyland-Yutani-Emblem, wie auf der Vorlage
  const wy = el('g', { transform: 'translate(168 790) scale(.55)', class: 'sm-wy' }, world);
  el('path', { d: 'M0 1 H22 L38 27 L50 11 H70 L82 27 L98 1 H120 L92 39 H74 L60 19 L46 39 H28 Z' }, wy);
  el('path', { d: 'M50 1 H70 L60 8 Z' }, wy);

  // Sterne
  const T = { x: 352, y: 522 };
  for (let i = 0; i < 520; i++) {
    const x = BOUNDS.x + r() * BOUNDS.w;
    const y = BOUNDS.y + r() * BOUNDS.h;
    if (Math.hypot(x - T.x, y - T.y) < 22) continue;
    if (r() < 0.14) el('path', { d: sparkle(x, y, 3 + r() * 4), class: 'sm-star big' }, world);
    else el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (0.7 + r() * 1.3).toFixed(1), class: 'sm-star' }, world);
  }

  // Sol
  el('circle', { cx: SOL.x, cy: SOL.y, r: 18, class: 'sm-ring' }, world);
  el('circle', { cx: SOL.x, cy: SOL.y, r: 7, class: 'm-target' }, world);
  txt(world, SOL.x + 26, SOL.y + 8, 'SOL', 'sm-sol');

  // Route Sol → Ziel (wird beim Anflug gezeichnet)
  const route = el('line', { x1: SOL.x, y1: SOL.y, x2: SOL.x, y2: SOL.y, class: 'sm-route' }, world);

  // Zielstern
  el('path', { d: sparkle(T.x, T.y, 9), class: 'sm-target' }, world);

  const homeW = 860;
  const homeH = (homeW * 446) / 1000;
  return {
    title: 'STERNENKARTE // GALACTIC POSITION',
    target: T,
    home: { x: T.x - homeW * 0.36, y: T.y - homeH / 2, w: homeW, h: homeH },
    start: { cx: SOL.x, cy: SOL.y, w: 1900 },
    via: { x: 330, y: 930 },
    world,
    route,
    lock: ['TARGET LOCKED', cfg.star],
    coord: `${cfg.starmap.distancePc.toFixed(2)} PC`,
    lockTag: 'A',
    lockScale: homeW / 1000,
    next: `SYSTEMKARTE ${cfg.star}`,
    panel: true,
  };
}
