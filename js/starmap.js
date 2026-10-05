// Sternenkarte im Terminal-Stil, nachgebaut nach der Vorlage (Gebiete, Ringe, Raster, Sektoren).
// Namen der Systeme und Sektoren stammen aus dem Editor (CONFIG.starmap.systems / .sectors).

import { el, txt, rng } from './svg.js';
import { STARMAP } from './starmap-data.js';

export const S = 2; // Karteneinheiten pro Pixel der Vorlage
const P = (x, y) => ({ x: x * S, y: y * S });
export const SOL = P(...STARMAP.sol);

const pathOf = (pts) => `M${pts.map(([x, y]) => `${x * S} ${y * S}`).join('L')}Z`;
const circle = (c, r) => `M${c.x - r} ${c.y} A${r} ${r} 0 1 0 ${c.x + r} ${c.y} A${r} ${r} 0 1 0 ${c.x - r} ${c.y} Z`;

function sparkle(x, y, s) {
  const k = s * 0.22;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
}

function patterns(defs) {
  const dots = el('pattern', { id: 'pt-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 4, cy: 4, r: 1.4, class: 'sm-dotfill' }, dots);
  const stripes = el('pattern', { id: 'pt-stripes', width: 12, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { x: 0, y: 0, width: 12, height: 5, class: 'sm-stripefill' }, stripes);
  const hatch = el('pattern', { id: 'pt-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { x: 0, y: 0, width: 2.5, height: 7, class: 'sm-hatchfill' }, hatch);
}

export function systemName(cfg, sys) {
  if (sys.id === STARMAP.targetId) return cfg.starmap?.systems?.[sys.id]?.name || cfg.star;
  return cfg.starmap?.systems?.[sys.id]?.name || '';
}

export function sectorName(cfg, sec) {
  if (sec.target) return cfg.starmap?.sectors?.[sec.id] || cfg.sector;
  return cfg.starmap?.sectors?.[sec.id] || '';
}

// Zeichnet die Karte; opts.editor = Systeme/Sektoren anklickbar (Editor)
export function drawStarmapLayer(world, cfg, opts = {}) {
  const r = rng(282);
  const defs = el('defs', {}, world);
  patterns(defs);
  const [fx0, fy0, fx1, fy1] = STARMAP.frame;

  // Gebiete (Reihenfolge wie in der Vorlage: Grenzgebiet unten, Kerngebiete oben)
  const cls = { fr: 'sm-frontier', ua: 'sm-ua', upp: 'sm-upp', twe: 'sm-twe', ind: 'sm-indep' };
  for (const k of ['fr', 'ua', 'upp', 'twe', 'ind']) {
    (STARMAP.regions[k] || []).forEach((p) => el('path', { d: pathOf(p), class: cls[k] }, world));
  }

  // Raster (1 Feld = 1 Parsec)
  const grid = el('g', { class: 'sm-grid' }, world);
  const gd = STARMAP.grid;
  for (let i = 0; i < gd.nx; i++) { const x = (gd.x0 + i * gd.dx) * S; el('line', { x1: x, y1: fy0 * S, x2: x, y2: fy1 * S }, grid); }
  for (let j = 0; j < gd.ny; j++) { const y = (gd.y0 + j * gd.dy) * S; el('line', { x1: fx0 * S, y1: y, x2: fx1 * S, y2: y }, grid); }
  el('rect', { x: fx0 * S, y: fy0 * S, width: (fx1 - fx0) * S, height: (fy1 - fy0) * S, class: 'sm-frame' }, world);

  // Achsen mit Parsec-Zählung ab Sol
  const ax = 678 * S;
  const ay = 446 * S;
  el('line', { x1: fx0 * S, y1: ay, x2: fx1 * S, y2: ay, class: 'sm-axis' }, world);
  el('line', { x1: ax, y1: fy0 * S, x2: ax, y2: fy1 * S, class: 'sm-axis' }, world);
  for (let i = 0; i < gd.nx; i++) {
    const x = (gd.x0 + i * gd.dx) * S;
    const n = Math.round(Math.abs(x - ax) / (gd.dx * S));
    if (n > 0) txt(world, x, ay + 22, String(n), 'sm-num', { 'text-anchor': 'middle' });
  }
  for (let j = 0; j < gd.ny; j++) {
    const y = (gd.y0 + j * gd.dy) * S;
    const n = Math.round(Math.abs(y - ay) / (gd.dy * S));
    if (n > 0) txt(world, ax + 8, y + 18, String(n), 'sm-num');
  }
  txt(world, (fx0 + 14) * S, ay - 12, '◂ RIMWARD', 'sm-dir');
  txt(world, (fx1 - 14) * S, ay - 12, 'COREWARD ▸', 'sm-dir', { 'text-anchor': 'end' });
  txt(world, ax + 14, (fy0 + 16) * S, '▴ SPINWARD', 'sm-dir');
  txt(world, ax - 14, (fy1 - 10) * S, 'TRAILWARD ▾', 'sm-dir', { 'text-anchor': 'end' });

  // Ringe
  const labels = { rim: 'OUTER RIM TERRITORIES', veil: 'OUTER VEIL', core: 'CORE SYSTEMS' };
  STARMAP.rings.forEach((ring, i) => {
    const c = P(...ring.c);
    ring.r.forEach((rad) => el('path', { d: circle(c, rad * S), class: 'sm-ring' }, world));
    const rr = Math.max(...ring.r) * S + 10;
    const a1 = (-128 * Math.PI) / 180;
    const a2 = (-52 * Math.PI) / 180;
    const id = `sm-arc-${i}`;
    el('path', { id, d: `M${c.x + rr * Math.cos(a1)} ${c.y + rr * Math.sin(a1)} A${rr} ${rr} 0 0 1 ${c.x + rr * Math.cos(a2)} ${c.y + rr * Math.sin(a2)}`, fill: 'none' }, defs);
    const t = el('text', { class: 'sm-arc' }, world);
    const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, t);
    tp.textContent = labels[ring.label] || '';
  });

  // Hintergrundsterne
  STARMAP.decor.forEach(([x, y]) => el('path', { d: sparkle(x * S, y * S, 4 + r() * 3), class: 'sm-star' }, world));
  for (let i = 0; i < 260; i++) {
    const x = (fx0 + r() * (fx1 - fx0)) * S;
    const y = (fy0 + r() * (fy1 - fy0)) * S;
    el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (0.6 + r() * 1).toFixed(1), class: 'sm-star dim' }, world);
  }

  // Sektorfelder
  const nodes = {};
  STARMAP.sectors.forEach((sec, i) => {
    const name = sectorName(cfg, sec);
    const w = Math.max(sec.w, name.length * 4.2 + 8) * S;
    const h = 11 * S;
    const x = sec.x * S - w / 2;
    const y = sec.y * S - h / 2;
    const g = el('g', { class: `sm-sector${sec.target ? ' hot' : ''}`, 'data-sec': sec.id }, world);
    el('rect', { x, y, width: w, height: h, class: 'sm-box' }, g);
    txt(g, sec.x * S, sec.y * S + 5, name || (opts.editor ? `S${i + 1}` : 'NO DATA'), 'sm-box-t', { 'text-anchor': 'middle' });
    nodes[sec.id] = g;
  });

  // Sol
  el('circle', { cx: SOL.x, cy: SOL.y, r: 14, class: 'sm-ring' }, world);
  el('circle', { cx: SOL.x, cy: SOL.y, r: 6, class: 'm-target' }, world);
  txt(world, SOL.x - 22, SOL.y + 6, 'SOL', 'sm-sol', { 'text-anchor': 'end' });

  // Sternensysteme (benennbar)
  STARMAP.systems.forEach((sys) => {
    const p = P(sys.x, sys.y);
    const isT = sys.id === STARMAP.targetId;
    const g = el('g', { class: `sm-sys${isT ? ' target' : ''}`, 'data-sys': sys.id }, world);
    el('path', { d: sparkle(p.x, p.y, isT ? 10 : 7), class: isT ? 'sm-target' : 'sm-star big' }, g);
    if (opts.editor) el('circle', { cx: p.x, cy: p.y, r: 13, class: 'sm-hit' }, g);
    const name = systemName(cfg, sys);
    const sub = cfg.starmap?.systems?.[sys.id]?.sub || '';
    if (name && !isT) {
      txt(g, p.x + 12, p.y - 4, name, 'sm-name');
      if (sub) txt(g, p.x + 12, p.y + 14, sub, 'sm-sub');
    }
    if (opts.editor && !name) txt(g, p.x + 10, p.y - 6, sys.id.slice(1), 'sm-idx');
    nodes[sys.id] = g;
  });
  return nodes;
}

export function drawStarmap(g, cfg) {
  const world = el('g', {}, g);
  drawStarmapLayer(world, cfg);
  const T = P(...STARMAP.target);
  const route = el('line', { x1: SOL.x, y1: SOL.y, x2: SOL.x, y2: SOL.y, class: 'sm-route' }, world);
  // Ziel vor die Route legen
  world.appendChild(world.querySelector('.sm-sys.target'));

  const homeW = 860;
  const homeH = (homeW * 446) / 1000;
  return {
    title: 'STERNENKARTE // GALACTIC POSITION',
    target: T,
    home: { x: T.x - homeW * 0.36, y: T.y - homeH / 2, w: homeW, h: homeH },
    start: { cx: SOL.x, cy: SOL.y, w: 2100 },
    via: { x: SOL.x + 120, y: SOL.y + 420 },
    world,
    route,
    lock: cfg.starLock || ['TARGET LOCKED', cfg.star],
    coord: `${Number(cfg.starmap.distancePc || 0).toFixed(2)} PC`,
    lockTag: 'A',
    lockScale: homeW / 1000,
    next: `SYSTEMKARTE ${cfg.star}`,
    panel: true,
  };
}
