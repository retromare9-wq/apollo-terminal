// Editierbare Kartenebene: Türen (mit Sicherheitsstufe), Trennlinien, Kameras, Raumdaten.
// Gemeinsam genutzt von Terminal (Anzeige) und Karten-Editor (Bearbeitung).

import { el } from './svg.js';

export const UNITS_PER_M = 20;

export const SECURITY = {
  green: { label: 'GRÜN', text: 'OFFEN FÜR ALLE' },
  orange: { label: 'ORANGE', text: 'KARTE STUFE ORANGE' },
  red: { label: 'ROT', text: 'VOLLZUGRIFF' },
};

// Kameras: fester Öffnungswinkel, Reichweite einstellbar (in Karteneinheiten)
export const CAM = { fov: 70, min: 3 * UNITS_PER_M, max: 12 * UNITS_PER_M, def: 7 * UNITS_PER_M };

export const STATUS = {
  '': 'IN ORDNUNG',
  warn: 'WARNUNG',
  damage: 'SCHADEN',
  offline: 'OFFLINE',
  sealed: 'ABGERIEGELT',
};

export const DOOR_LEN = 30;
export const DOOR_T = 9;

// Felder der ausführlichen Raumbeschreibung (Reihenfolge wie im Editor)
export const DESC_FIELDS = [
  ['aesthetic', 'ALLGEMEINE ÄSTHETIK & DESIGNPRINZIPIEN'],
  ['smell', 'WAS RIECHT MAN'],
  ['sight', 'WAS SIEHT MAN'],
  ['sound', 'WAS HÖRT MAN'],
  ['investigate', 'WAS ERFÄHRT MAN NACH GENAUERER UNTERSUCHUNG'],
];
export const MAX_PICTOS = 5;

export function emptyLayer() {
  return { doors: [], lines: [], cams: [], rooms: {}, lifts: {}, labels: {}, settings: { showCams: true } };
}

function normalize(l) {
  const e = emptyLayer();
  return {
    doors: Array.isArray(l?.doors) ? l.doors : e.doors,
    lines: Array.isArray(l?.lines) ? l.lines : e.lines,
    cams: Array.isArray(l?.cams) ? l.cams : e.cams,
    rooms: l?.rooms && typeof l.rooms === 'object' ? l.rooms : e.rooms,
    lifts: l?.lifts && typeof l.lifts === 'object' ? l.lifts : e.lifts,
    labels: l?.labels && typeof l.labels === 'object' ? l.labels : e.labels,
    settings: { ...e.settings, ...(l?.settings || {}) },
  };
}

const key = (levelId) => `apollo.map.${levelId}.v2`;

// Gespeicherte Bearbeitung aus dem Browser, sonst die Vorgabe aus dem Projekt.
export function loadLayer(levelId, fallback) {
  try {
    const raw = localStorage.getItem(key(levelId));
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* ohne Speicher weiter */ }
  return normalize(JSON.parse(JSON.stringify(fallback || emptyLayer())));
}

export function saveLayer(levelId, layer) {
  try { localStorage.setItem(key(levelId), JSON.stringify(layer)); } catch { /* ignorieren */ }
}

export function storageKey(levelId) { return key(levelId); }

export function importLayer(json) { return normalize(json); }

// ---------- Geometrie ----------

export const inRect = (r, x, y, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;

export function roomAt(level, x, y) {
  return level.rooms.find((r) => r.rects.some((rc) => inRect(rc, x, y))) || null;
}

export function corridorAt(level, x, y) {
  // kleinstes passendes Gangstück (an Kreuzungen das schmalere)
  let best = null;
  for (const c of level.corridors) {
    if (!inRect(c, x, y)) continue;
    const a = (c[2] - c[0]) * (c[3] - c[1]);
    if (!best || a < best.a) best = { c, a };
  }
  return best ? best.c : null;
}

// Rechtecke, in denen eine Kamera „sieht“: der eigene Raum bzw. das eigene Gangstück
export function containerRects(level, x, y) {
  const room = roomAt(level, x, y);
  if (room) return room.rects;
  return corridorAt(level, x, y) ? level.corridors : null;
}

// Tür an der Mausposition einrasten: quer über einen Gang oder auf die nächste Raumwand.
export function snapDoor(level, x, y) {
  const c = corridorAt(level, x, y);
  if (c) {
    const w = c[2] - c[0];
    const h = c[3] - c[1];
    if (h > w) return { o: 'h', x: (c[0] + c[2]) / 2, y: Math.round(y / 5) * 5, len: w };
    return { o: 'v', x: Math.round(x / 5) * 5, y: (c[1] + c[3]) / 2, len: h };
  }
  let best = null;
  const consider = (d, o, px, py) => { if (d < 22 && (!best || d < best.d)) best = { d, o, x: px, y: py }; };
  for (const room of level.rooms) {
    for (const [x0, y0, x1, y1] of room.rects) {
      const cx = Math.min(Math.max(x, x0 + DOOR_LEN / 2), x1 - DOOR_LEN / 2);
      const cy = Math.min(Math.max(y, y0 + DOOR_LEN / 2), y1 - DOOR_LEN / 2);
      if (x >= x0 - 22 && x <= x1 + 22) {
        consider(Math.abs(y - y0), 'h', cx, y0);
        consider(Math.abs(y - y1), 'h', cx, y1);
      }
      if (y >= y0 - 22 && y <= y1 + 22) {
        consider(Math.abs(x - x0), 'v', x0, cy);
        consider(Math.abs(x - x1), 'v', x1, cy);
      }
    }
  }
  if (!best) return null;
  return { o: best.o, x: Math.round(best.x / 5) * 5, y: Math.round(best.y / 5) * 5, len: DOOR_LEN };
}

export function doorRect(d) {
  return d.o === 'h'
    ? { x: d.x - d.len / 2, y: d.y - DOOR_T / 2, width: d.len, height: DOOR_T }
    : { x: d.x - DOOR_T / 2, y: d.y - d.len / 2, width: DOOR_T, height: d.len };
}

export function camWedge(c) {
  const a0 = ((c.dir - CAM.fov / 2) * Math.PI) / 180;
  const a1 = ((c.dir + CAM.fov / 2) * Math.PI) / 180;
  const p0 = [c.x + c.range * Math.cos(a0), c.y + c.range * Math.sin(a0)];
  const p1 = [c.x + c.range * Math.cos(a1), c.y + c.range * Math.sin(a1)];
  return `M${c.x} ${c.y} L${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${c.range} ${c.range} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z`;
}

export function camHandle(c) {
  const a = (c.dir * Math.PI) / 180;
  return { x: c.x + c.range * Math.cos(a), y: c.y + c.range * Math.sin(a) };
}

// Türen und Kameras, die zu einem Raum gehören
export function roomDoors(layer, room) {
  return layer.doors.filter((d) => room.rects.some((rc) => inRect(rc, d.x, d.y, 3)));
}
export function roomCams(layer, room) {
  return layer.cams.filter((c) => room.rects.some((rc) => inRect(rc, c.x, c.y)));
}

// ---------- Zeichnen ----------

let clipSeq = 0;

export function drawLayer(g, level, layer, { cams = true, editor = false } = {}) {
  const nodes = {};
  const defs = el('defs', {}, g);

  const lineLayer = el('g', { class: 'ly-lines' }, g);
  layer.lines.forEach((l) => {
    const n = el('line', { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, class: 'ly-line', 'data-oid': l.id, 'data-kind': 'line' }, lineLayer);
    if (editor) el('line', { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, class: 'ly-hit', 'data-oid': l.id, 'data-kind': 'line' }, lineLayer);
    nodes[l.id] = n;
  });

  if (cams) {
    const camLayer = el('g', { class: 'ly-cams' }, g);
    layer.cams.forEach((c) => {
      const cg = el('g', { class: 'ly-cam', 'data-oid': c.id, 'data-kind': 'cam' }, camLayer);
      const rects = containerRects(level, c.x, c.y);
      let clip = null;
      if (rects) {
        clip = `camclip-${++clipSeq}`;
        const cp = el('clipPath', { id: clip }, defs);
        rects.forEach(([x0, y0, x1, y1]) => el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, cp));
      }
      // Kegel: Verlauf ausgehend von der Kamera
      const cone = el('g', clip ? { 'clip-path': `url(#${clip})` } : {}, cg);
      const fill = el('radialGradient', { id: `cg-${++clipSeq}`, cx: c.x, cy: c.y, r: c.range, gradientUnits: 'userSpaceOnUse' }, defs);
      el('stop', { offset: '0', 'stop-color': '#6cc495', 'stop-opacity': '.42' }, fill);
      el('stop', { offset: '1', 'stop-color': '#6cc495', 'stop-opacity': '.04' }, fill);
      el('path', { d: camWedge(c), fill: `url(#${fill.id})`, class: 'ly-cone' }, cone);
      el('circle', { cx: c.x, cy: c.y, r: 7, class: 'ly-camdot' }, cg);
      const h = { x: c.x + 13 * Math.cos((c.dir * Math.PI) / 180), y: c.y + 13 * Math.sin((c.dir * Math.PI) / 180) };
      el('line', { x1: c.x, y1: c.y, x2: h.x, y2: h.y, class: 'ly-camdir' }, cg);
      nodes[c.id] = cg;
    });
  }

  const doorLayer = el('g', { class: 'ly-doors' }, g);
  layer.doors.forEach((d) => {
    const n = el('rect', { ...doorRect(d), class: `ly-door sec-${d.sec || 'green'}`, 'data-oid': d.id, 'data-kind': 'door' }, doorLayer);
    nodes[d.id] = n;
  });
  return nodes;
}
