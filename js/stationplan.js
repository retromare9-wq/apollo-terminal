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
export const liftData = (l, layer) => ({ letter: l.id === 'MF' ? '' : l.id, sec: '', access: '', ...(layer?.lifts?.[l.id] || {}) });

// Schrift skaliert beim Herauszoomen mit und verschwindet bei großer Entfernung.
// k = Karteneinheiten pro Bildschirmpixel
export function applyZoom(svg, k) {
  svg.style.setProperty('--k', k.toFixed(4));
  svg.classList.toggle('z-far', k > 6.5);
  svg.classList.toggle('z-mid', k > 4.6);
}

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

// Aufzug: Kasten blau umrandet, darin Aufzugs- und Leitergang-Piktogramm
function lift(g, l, layer) {
  const data = liftData(l, layer);
  const [x0, y0, x1, y1] = l.rect;
  const horizontal = x1 - x0 >= y1 - y0;
  const size = horizontal ? y1 - y0 : x1 - x0;
  const liftFirst = l.dark === 'dl' || l.dark === 'dt';
  const lg = el('g', { class: `st-lift${data.sec ? ` sec-${data.sec}` : ''}`, 'data-lift': l.id }, g);
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-liftbg' }, lg);
  const icons = liftFirst ? [32, 28] : [28, 32];
  icons.forEach((id, i) => {
    const ox = horizontal ? x0 + i * size : x0;
    const oy = horizontal ? y0 : y0 + i * size;
    const ig = el('g', { transform: `translate(${ox + size * 0.04} ${oy + size * 0.04}) scale(${(size * 0.92) / 100})` }, lg);
    ig.innerHTML = semioticById(id).svg;
  });
  el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-liftframe' }, lg);
  if (data.letter) {
    const lx = horizontal ? x0 - 10 : (x0 + x1) / 2;
    const ly = horizontal ? (y0 + y1) / 2 : y0 - 12;
    txt(g, lx, ly, data.letter, 'st-liftid lbl', { 'text-anchor': horizontal ? 'end' : 'middle', 'dominant-baseline': horizontal ? 'middle' : 'auto' });
  }
}

// Bereichsüberschriften: Vorgabe aus dem Grundriss, überschrieben/ergänzt durch den Editor
export function planLabels(level, layer) {
  const exit = level.corridors.reduce((m, c) => (c[2] > m[2] ? c : m));
  const base = [
    ...level.labels.map((l, i) => ({ id: `lbl${i}`, text: l.text, x: l.x, y: l.y })),
    { id: 'lbl-exit', text: 'ZUM FLUGFELD ▶', x: exit[2] + 30, y: (exit[1] + exit[3]) / 2 },
  ];
  const over = layer?.labels || {};
  const out = base.map((l) => ({ ...l, ...(over[l.id] || {}) }));
  for (const [id, l] of Object.entries(over)) if (l.custom) out.push({ id, ...l });
  return out.filter((l) => !l.hidden && l.text);
}

// layer: editierbare Ebene (Türen, Linien, Kameras, Raumdaten), opts: { cams, editor }
export function drawStationPlan(g, cfg, level, layer, opts = {}) {
  const [bx0, by0, bx1, by1] = level.bounds;
  const statusOf = (id) => layer.rooms[id]?.status || '';

  const corr = el('g', { class: 'st-corrs' }, g);
  // Erst eine Kontur um alle Gänge, dann die Füllung – so entstehen an Kreuzungen keine Nähte
  level.corridors.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-corr-edge' }, corr));
  level.corridors.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-corr' }, corr));

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
      txt(labelLayer, b[0] + 8, b[1] + 8, label.toUpperCase(), `${big ? 'st-name' : 'st-num'} rlbl`, { 'dominant-baseline': 'hanging' });
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
  const labelNodes = {};
  planLabels(level, layer).forEach((l) => {
    const cls = /^[a-z]$/.test(l.text) ? 'st-row' : /^LEVEL/.test(l.text) ? 'st-level' : 'st-zone';
    labelNodes[l.id] = txt(labelLayer, l.x, l.y, l.text, `${cls} lbl`, { 'dominant-baseline': 'middle', 'data-oid': l.id, 'data-kind': 'label' });
  });

  const home = frame([bx0, by0, bx1, by1], 90);
  return {
    title: `STATIONSPLAN ${cfg.stationCode} // ${level.name}`,
    target: { x: home.x + home.w / 2, y: home.y + home.h / 2 },
    home,
    noLock: true,
    plan: { level, layer, nodes, objects: { ...objects, ...labelNodes } },
  };
}
