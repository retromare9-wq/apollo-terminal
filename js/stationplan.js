// Stationsplan einer Ebene: Gänge, Räume, Türen, Aufzüge.
// Schriftgrößen skalieren über die CSS-Variable --k mit dem Zoom, damit sie
// auf dem Bildschirm immer gleich groß bleiben.

import { el, txt } from './svg.js';
import { drawLayer } from './layer.js';
import { semioticById } from './semiotic.js';

const ASPECT = 446 / 1000;

export function roomName(level, room, layer) {
  const custom = layer?.rooms?.[room.id]?.name;
  if (custom) return custom.toUpperCase();
  if (room.unit) return `${room.kind === 'family' ? 'FAMILIENQUARTIER' : 'EINZELQUARTIER'} ${room.unit}`;
  const zone = level.zones[room.zone] || room.zone.toUpperCase();
  if (room.label) return `${zone} ${room.label}`;
  return `${zone} ${room.id.split('-').slice(1).join('-')}`;
}

export const roomCode = (room, layer) => layer?.rooms?.[room.id]?.code || room.id;
export const roomZone = (level, room, layer) => layer?.rooms?.[room.id]?.zoneName || level.zones[room.zone] || room.zone.toUpperCase();
export const liftData = (l, layer) => ({ letter: l.id, sec: '', access: '', ...(layer?.lifts?.[l.id] || {}) });

export function bbox(rects) {
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

function lift(g, l, layer) {
  const data = liftData(l, layer);
  const [x0, y0, x1, y1] = l.rect;
  const horizontal = l.dark === 'dl' || l.dark === 'dr';
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const car = { dl: [x0, y0, mx, y1], dr: [mx, y0, x1, y1], dt: [x0, y0, x1, my], db: [x0, my, x1, y1] }[l.dark];
  const shaft = { dl: [mx, y0, x1, y1], dr: [x0, y0, mx, y1], dt: [x0, my, x1, y1], db: [x0, y0, x1, my] }[l.dark];
  const lg = el('g', { class: `st-lift${data.sec ? ` sec-${data.sec}` : ''}`, 'data-lift': l.id }, g);
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
  if (data.letter) {
    const lx = horizontal ? x0 - 10 : (x0 + x1) / 2;
    const ly = horizontal ? (y0 + y1) / 2 : y0 - 12;
    const name = l.id === 'MF' && data.letter === 'MF' ? 'MAINFRAME ▼ -1' : data.letter;
    txt(g, lx, ly, name, 'st-liftid', { 'text-anchor': horizontal ? 'end' : 'middle', 'dominant-baseline': horizontal ? 'middle' : 'auto' });
  }
}

// layer: editierbare Ebene (Türen, Linien, Kameras, Raumdaten), opts: { cams, editor }
export function drawStationPlan(g, cfg, level, layer, opts = {}) {
  const [bx0, by0, bx1, by1] = level.bounds;
  const statusOf = (id) => layer.rooms[id]?.status || '';

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

  const objects = drawLayer(el('g', {}, g), level, layer, {
    cams: opts.cams ?? layer.settings.showCams,
    editor: !!opts.editor,
  });

  const liftLayer = el('g', {}, g);
  level.lifts.forEach((l) => lift(liftLayer, l, layer));

  // Beschriftungen: Raumnummern, Statusmarken, Bereichsnamen
  const labelLayer = el('g', {}, g);
  level.rooms.forEach((room) => {
    const b = bbox(room.rects);
    const status = statusOf(room.id);
    const custom = layer.rooms[room.id]?.name;
    const label = custom || room.label;
    if (label) {
      const big = label.length > 3;
      txt(labelLayer, b[0] + 8, b[1] + 8, label.toUpperCase(), big ? 'st-name' : 'st-num', { 'dominant-baseline': 'hanging' });
    }
    const pics = (layer.rooms[room.id]?.picto || []).filter((p) => p.map).slice(0, 5);
    if (pics.length) {
      const size = Math.min(26, (b[2] - b[0] - 8) / pics.length - 3, b[3] - b[1] - 8);
      pics.forEach((p, i) => {
        const s = semioticById(p.id);
        if (!s) return;
        const x = b[2] - 4 - (pics.length - i) * (size + 3) + 3;
        const ig = el('g', { transform: `translate(${x} ${b[1] + 4}) scale(${size / 100})`, class: 'st-picto' }, labelLayer);
        ig.innerHTML = s.svg;
      });
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

  const home = frame([bx0, by0, bx1, by1], 90);
  return {
    title: `STATIONSPLAN ${cfg.stationCode} // ${level.name}`,
    target: { x: home.x + home.w / 2, y: home.y + home.h / 2 },
    home,
    noLock: true,
    plan: { level, layer, nodes, objects },
  };
}
