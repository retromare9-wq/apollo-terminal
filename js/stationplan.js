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
  if (room.name) return room.name;
  if (room.unit) return `${room.kind === 'family' ? 'FAMILIENQUARTIER' : 'EINZELQUARTIER'} ${room.unit}`;
  const zone = level.zones[room.zone] || room.zone.toUpperCase();
  if (!zone) return room.id;
  if (room.label) return `${zone} ${room.label}`;
  return `${zone} ${room.id.split('-').slice(1).join('-')}`;
}

export const roomCode = (room, layer) => layer?.rooms?.[room.id]?.code || room.id;
// Position der Raum-ID: gespeichert oder oben links im Raum
export function roomIdPos(room, layer) {
  const p = layer?.rooms?.[room.id]?.idPos;
  if (p) return p;
  const b = bbox(room.rects);
  return { x: b[0] + 6, y: b[1] + 6 };
}
export const roomZone = (level, room, layer) => layer?.rooms?.[room.id]?.zoneName || level.zones[room.zone] || room.zone.toUpperCase() || '–';
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
  const base = (level.labels || []).map((l, i) => ({ id: l.id || `lbl${i}`, text: l.text, x: l.x, y: l.y }));
  const over = layer?.labels || {};
  const out = base.map((l) => ({ ...l, ...(over[l.id] || {}) }));
  for (const [id, l] of Object.entries(over)) if (l.custom) out.push({ id, ...l });
  return out.filter((l) => !l.hidden && l.text);
}

// layer: editierbare Ebene (Türen, Linien, Kameras, Raumdaten), opts: { cams, editor }
export function drawStationPlan(g, cfg, level, layer, opts = {}) {
  const [bx0, by0, bx1, by1] = level.bounds || [0, 0, 1000, 600];
  const statusOf = (id) => layer.rooms[id]?.status || '';

  // Farben aus dem Editor über CSS-Variablen, damit Statusfarben (Schaden usw.) Vorrang behalten
  const colors = (fill, stroke, f, s) => [fill ? `${f}:${fill}` : '', stroke ? `${s}:${stroke}` : ''].filter(Boolean).join(';');

  // Korridore vor den Räumen: wo sich Rahmen überlagern, ist der Raumrahmen zu sehen.
  // Erst alle Rahmen, dann alle Füllungen – so entstehen an Kreuzungen keine Nähte.
  const corr = el('g', { class: 'st-corrs' }, g);
  const corrNodes = [];
  const cAttr = (c, i, cls) => {
    const style = colors(c[4]?.fill, c[4]?.stroke, '--cf', '--cs');
    return { x: c[0], y: c[1], width: c[2] - c[0], height: c[3] - c[1], class: cls, 'data-corr': i, ...(style ? { style } : {}) };
  };
  level.corridors.forEach((c, i) => { corrNodes[i] = [el('rect', cAttr(c, i, 'st-corr-edge'), corr)]; });
  level.corridors.forEach((c, i) => { corrNodes[i].push(el('rect', cAttr(c, i, 'st-corr'), corr)); });

  const roomLayer = el('g', {}, g);
  const nodes = {};
  level.rooms.forEach((room) => {
    const status = statusOf(room.id);
    const style = colors(room.fill, room.stroke, '--rf', '--rs');
    const rg = el('g', { class: `st-room z-${room.zone}${status ? ` s-${status}` : ''}`, 'data-id': room.id, ...(style ? { style } : {}) }, roomLayer);
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
    // Raum-ID auf der Karte (Häkchen im Editor), Position im Raum verschiebbar
    const rd = layer.rooms[room.id];
    if (rd?.showId) {
      const p = roomIdPos(room, layer);
      const b0 = bbox(room.rects);
      const max = Math.max(8, Math.min(18, Math.min(b0[2] - b0[0], b0[3] - b0[1]) * 0.4));
      txt(labelLayer, p.x, p.y, roomCode(room, layer).toUpperCase(), 'st-rid rlbl', { 'dominant-baseline': 'hanging', 'data-oid': room.id, 'data-kind': 'rid', style: `font-size: min(calc(var(--k, 1) * 10px), ${max.toFixed(1)}px)` });
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
    title: `STATIONSPLAN ${level.mapName || cfg.stationCode} // ${level.name}`,
    target: { x: home.x + home.w / 2, y: home.y + home.h / 2 },
    home,
    noLock: true,
    plan: { level, layer, nodes, corrNodes, objects: { ...objects, ...labelNodes } },
  };
}
