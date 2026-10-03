// Stationsplan einer Ebene: Gänge, Räume, Türen, Aufzüge.
// Schriftgrößen skalieren über die CSS-Variable --k mit dem Zoom, damit sie
// auf dem Bildschirm immer gleich groß bleiben.

import { el, txt } from './svg.js';

const ASPECT = 446 / 1000;

export function roomName(level, room) {
  const zone = level.zones[room.zone] || room.zone.toUpperCase();
  if (room.label === 'KANTINE' || room.label === 'MARSHAL') return room.label;
  if (room.label) return `${zone} ${room.label}`;
  return `${zone} ${room.id.split('-').slice(1).join('-')}`;
}

function bbox(rects) {
  return rects.reduce((b, r) => [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])],
    [Infinity, Infinity, -Infinity, -Infinity]);
}

// Rechteck mit dem Seitenverhältnis der Kartenansicht um ein Gebiet legen.
export function frame(b, pad) {
  let w = b[2] - b[0] + pad * 2;
  let h = b[3] - b[1] + pad * 2;
  if (h / w > ASPECT) w = h / ASPECT;
  else h = w * ASPECT;
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function lift(g, l) {
  const [x0, y0, x1, y1] = l.rect;
  const horizontal = l.dark === 'dl' || l.dark === 'dr';
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const car = { dl: [x0, y0, mx, y1], dr: [mx, y0, x1, y1], dt: [x0, y0, x1, my], db: [x0, my, x1, y1] }[l.dark];
  const shaft = { dl: [mx, y0, x1, y1], dr: [x0, y0, mx, y1], dt: [x0, my, x1, y1], db: [x0, y0, x1, my] }[l.dark];
  const lg = el('g', { class: 'st-lift' }, g);
  el('rect', { x: shaft[0], y: shaft[1], width: shaft[2] - shaft[0], height: shaft[3] - shaft[1], class: 'st-shaft' }, lg);
  // Leitersprossen im Leitergang
  for (let i = 1; i < 4; i++) {
    if (horizontal) {
      const x = shaft[0] + ((shaft[2] - shaft[0]) * i) / 4;
      el('line', { x1: x, y1: shaft[1] + 4, x2: x, y2: shaft[3] - 4, class: 'st-rung' }, lg);
    } else {
      const y = shaft[1] + ((shaft[3] - shaft[1]) * i) / 4;
      el('line', { x1: shaft[0] + 4, y1: y, x2: shaft[2] - 4, y2: y, class: 'st-rung' }, lg);
    }
  }
  el('rect', { x: car[0], y: car[1], width: car[2] - car[0], height: car[3] - car[1], class: 'st-car' }, lg);
  el('path', { d: `M${car[0] + 6} ${car[1] + 6} L${car[2] - 6} ${car[3] - 6} M${car[2] - 6} ${car[1] + 6} L${car[0] + 6} ${car[3] - 6}`, class: 'st-cross' }, lg);
  if (l.id) {
    const lx = horizontal ? x0 - 10 : (x0 + x1) / 2;
    const ly = horizontal ? (y0 + y1) / 2 : y0 - 12;
    txt(g, lx, ly, l.id, 'st-liftid', { 'text-anchor': horizontal ? 'end' : 'middle', 'dominant-baseline': horizontal ? 'middle' : 'auto' });
  }
}

function door(g, d) {
  const len = d.len || 25;
  if (d.type === 'room') {
    // Öffnung in der Wand mit kleinen Anschlägen
    const a = d.o === 'h' ? { x1: d.x - len / 2, y1: d.y, x2: d.x + len / 2, y2: d.y } : { x1: d.x, y1: d.y - len / 2, x2: d.x, y2: d.y + len / 2 };
    el('line', { ...a, class: 'st-door-gap' }, g);
    el('line', { ...a, class: 'st-door' }, g);
    return;
  }
  const t = d.type === 'secure' ? 10 : 6;
  const r = d.o === 'h'
    ? { x: d.x - len / 2, y: d.y - t / 2, width: len, height: t }
    : { x: d.x - t / 2, y: d.y - len / 2, width: t, height: len };
  el('rect', { ...r, class: d.type === 'secure' ? 'st-secure' : 'st-normal' }, g);
}

export function drawStationPlan(g, cfg, station, statusOf) {
  const level = station.levels[0];
  const [bx0, by0, bx1, by1] = level.bounds;

  const corr = el('g', { class: 'st-corrs' }, g);
  level.corridors.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, corr));

  const roomLayer = el('g', {}, g);
  const nodes = {};
  level.rooms.forEach((room) => {
    const status = statusOf(room.id);
    const rg = el('g', { class: `st-room z-${room.zone}${status ? ` s-${status}` : ''}`, 'data-id': room.id }, roomLayer);
    room.rects.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-fill' }, rg));
    room.lines.forEach(([x0, y0, x1, y1]) => el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'st-inner' }, rg));
    room.rects.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-wall' }, rg));
    nodes[room.id] = rg;
  });

  const doorLayer = el('g', {}, g);
  level.doors.forEach((d) => door(doorLayer, d));

  const liftLayer = el('g', {}, g);
  level.lifts.forEach((l) => lift(liftLayer, l));

  // Beschriftungen: Raumnummern, Statusmarken, Bereichsnamen
  const labelLayer = el('g', {}, g);
  level.rooms.forEach((room) => {
    const b = bbox(room.rects);
    const status = statusOf(room.id);
    if (room.label) {
      const big = room.label.length > 3;
      txt(labelLayer, b[0] + 8, b[1] + 8, room.label, big ? 'st-name' : 'st-num', { 'dominant-baseline': 'hanging' });
    }
    if (status) {
      const sym = { warn: '▲', damage: '▲', offline: '■', sealed: '◆' }[status] || '▲';
      txt(labelLayer, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, sym, `st-mark s-${status}`, { 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    }
  });
  level.labels.forEach((l) => {
    const cls = /^[a-z]$/.test(l.text) ? 'st-row' : l.text.startsWith('LEVEL') ? 'st-level' : 'st-zone';
    txt(labelLayer, l.x, l.y, l.text, cls, { 'dominant-baseline': 'middle' });
  });
  // Ausgang zum Flugfeld
  const exit = level.corridors.reduce((m, c) => (c[2] > m[2] ? c : m));
  txt(labelLayer, exit[2] + 30, (exit[1] + exit[3]) / 2, 'ZUM FLUGFELD ▶', 'st-zone', { 'dominant-baseline': 'middle' });

  // Maßstab: ca. 20 Einheiten pro Meter
  const sx = bx1 - 520;
  const sy = by1 + 40;
  el('path', { d: `M${sx} ${sy - 12} V${sy} H${sx + 500} V${sy - 12}`, class: 'st-scale' }, labelLayer);
  txt(labelLayer, sx + 250, sy - 18, '25 M', 'st-zone', { 'text-anchor': 'middle' });

  const home = frame([bx0, by0, bx1, by1 + 50], 90);
  return {
    title: `STATIONSPLAN ${cfg.stationCode} // ${level.name}`,
    target: { x: home.x + home.w / 2, y: home.y + home.h / 2 },
    home,
    noLock: true,
    plan: { level, nodes },
  };
}
