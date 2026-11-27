// Spieltisch: GM-Karte (Laptop) und Spielerkarte (Fernseher/Beamer).
// Tokens, Notizen, Motion-Tracker-Pings, aufgedeckte Türen und freigegebene Kameras liegen
// im Browser (localStorage) und werden zwischen den Fenstern live abgeglichen.

import { CONFIG } from './data.js';
import { el, txt } from './svg.js';
import { drawStationPlan, roomName, roomCode, bbox } from './stationplan.js';
import { loadLayer } from './layer.js';
import { loadPlans, asLevel, levelNum, LAYER_FALLBACK, uid } from './plans.js';
import { findEntry } from './roomlist.js';

export const TABLE_KEY = 'apollo.table.v1';
export const PING_MS = 20000;
export const TOKEN_R = 14;                 // Radius in Karteneinheiten (≈ 1,4 m Durchmesser)
export const KINDS = { pc: 'SPIELERCHARAKTER', npc: 'NSC', alien: 'ALIEN', other: 'SONSTIGES' };
export const KIND_COLOR = { pc: '#3fa9f5', npc: '#e3cb5c', alien: '#e43a24', other: '#9a9a9a' };
export { uid };

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('apollo-table') : null;

export function emptyTable() {
  return { tokens: [], notes: [], pings: [], doors: {}, cams: {}, player: null };
}

export function loadTable() {
  let t = null;
  try { t = JSON.parse(localStorage.getItem(TABLE_KEY) || 'null'); } catch { /* leer */ }
  const e = emptyTable();
  t = { ...e, ...(t || {}) };
  for (const k of ['tokens', 'notes', 'pings']) if (!Array.isArray(t[k])) t[k] = [];
  for (const k of ['doors', 'cams']) if (!t[k] || typeof t[k] !== 'object') t[k] = {};
  t.pings = t.pings.filter((p) => p.keep || Date.now() - p.t < PING_MS);
  return t;
}

export function saveTable(t) {
  try { localStorage.setItem(TABLE_KEY, JSON.stringify(t)); } catch { return false; }
  channel?.postMessage('changed');
  return true;
}

// Änderungen aus dem anderen Fenster (GM ↔ Spieler)
export function onTableChange(fn) {
  channel?.addEventListener('message', () => fn());
  addEventListener('storage', (e) => { if (e.key === TABLE_KEY || (e.key || '').startsWith('apollo.map.') || e.key === 'apollo.plans.v1') fn(); });
}

// Alle Ebenen aller Karten (Reihenfolge wie im Editor)
export function allLevels() {
  const plans = loadPlans();
  return plans.maps.flatMap((m) => m.levels.map((l) => ({ id: l.id, mapId: m.id, mapName: m.name, terminal: m.terminal, plan: asLevel(m, l) })));
}

export const startLevel = (levels) => levels.find((l) => l.terminal && levelNum(l.plan.name) === 0) || levels.find((l) => l.terminal) || levels[0];

const esc = (s) => String(s ?? '');

// Raumname für die Karte: Raumliste (falls verknüpft), sonst Kartendaten
function roomLabel(lv, room, layer) {
  let e = null;
  try { e = findEntry({ levelId: lv.id, levelNo: levelNum(lv.plan.name), room, code: roomCode(room, layer), zone: '' }); } catch { /* ohne Raumliste */ }
  return { code: String(e?.roomId || roomCode(room, layer)).toUpperCase(), name: String(e?.name || roomName(lv.plan, room, layer)).toUpperCase() };
}

// Karte samt Spieltisch-Objekten zeichnen. mode: 'gm' | 'player'
export function drawTable(svg, lv, t, mode) {
  svg.replaceChildren();
  const g = el('g', { class: `tt tt-${mode}` }, svg);
  const layer = loadLayer(lv.id, LAYER_FALLBACK[lv.id]);
  const info = drawStationPlan(g, CONFIG, lv.plan, layer, { cams: true });
  const objs = info.plan.objects;

  // Türen: für Spieler grau, bis aufgedeckt (einzeln oder alle)
  const rev = t.doors[lv.id] || {};
  layer.doors.forEach((d) => {
    const n = objs[d.id];
    if (!n) return;
    const shown = rev.all || rev.ids?.[d.id];
    n.setAttribute('data-door', d.id);
    if (mode === 'player' && !shown) n.classList.add('door-grey');
    if (mode === 'gm') n.classList.toggle('door-shown', !!shown);
  });
  // Kameras: für Spieler nur einzeln freigegebene
  const camsOn = t.cams[lv.id] || {};
  layer.cams.forEach((c) => {
    const n = objs[c.id];
    if (!n) return;
    n.setAttribute('data-cam', c.id);
    if (!camsOn[c.id]) {
      if (mode === 'player') n.remove();
      else n.classList.add('cam-off');
    }
  });

  // Raum-ID und Raumname in jedem Raum
  const rl = el('g', { class: 'tt-rooms' }, g);
  lv.plan.rooms.forEach((room) => {
    const b = bbox(room.rects);
    const w = b[2] - b[0];
    const h = b[3] - b[1];
    const { code, name } = roomLabel(lv, room, layer);
    const fs = Math.max(5, Math.min(14, w / Math.max(6, name.length) * 1.5, h / 4));
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    txt(rl, cx, cy - fs * 0.15, name, 'tt-rname', { 'text-anchor': 'middle', style: `font-size:${fs.toFixed(1)}px` });
    txt(rl, cx, cy + fs * 1.05, code, 'tt-rcode', { 'text-anchor': 'middle', style: `font-size:${(fs * 0.8).toFixed(1)}px` });
  });

  // Notizen
  const nl = el('g', { class: 'tt-notes' }, g);
  t.notes.filter((n) => n.levelId === lv.id && (mode === 'gm' || n.visible)).forEach((n) => {
    const ng = el('g', { class: `tt-note${n.visible ? '' : ' gm-only'}`, 'data-note': n.id, transform: `translate(${n.x} ${n.y})` }, nl);
    el('circle', { r: 5, class: 'tt-pin', fill: n.color || '#e3cb5c' }, ng);
    const lines = esc(n.text).split('\n').slice(0, 6);
    const width = Math.max(...lines.map((l) => l.length), 4) * 5.6 + 12;
    el('rect', { x: 8, y: -9, width, height: lines.length * 11 + 8, rx: 2, class: 'tt-notebox', stroke: n.color || '#e3cb5c' }, ng);
    lines.forEach((l, i) => txt(ng, 14, 3 + i * 11, l, 'tt-notetext'));
  });

  // Tokens
  const tl = el('g', { class: 'tt-tokens' }, g);
  const defs = el('defs', {}, g);
  t.tokens.filter((k) => k.levelId === lv.id && (mode === 'gm' || !k.hidden)).forEach((k) => {
    const r = TOKEN_R * (Number(k.size) || 1);
    const color = k.color || KIND_COLOR[k.kind] || '#e3cb5c';
    const tg = el('g', { class: `tt-token${k.hidden ? ' hidden' : ''}`, 'data-token': k.id, transform: `translate(${k.x} ${k.y})` }, tl);
    if (k.img) {
      const cid = `tclip-${k.id}`;
      const cp = el('clipPath', { id: cid }, defs);
      el('circle', { r }, cp);
      el('circle', { r, fill: '#000' }, tg);
      el('image', { href: k.img, x: -r, y: -r, width: r * 2, height: r * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${cid})` }, tg);
    } else {
      el('circle', { r, fill: color, class: 'tt-tfill' }, tg);
      const short = esc(k.short || k.name).replace(/[^A-Za-zÄÖÜäöü0-9]/g, '').slice(0, 2).toUpperCase();
      txt(tg, 0, r * 0.32, short, 'tt-tshort', { 'text-anchor': 'middle', style: `font-size:${(r * 0.9).toFixed(1)}px` });
    }
    el('circle', { r, fill: 'none', stroke: color, 'stroke-width': 3, class: 'tt-ring' }, tg);
    txt(tg, 0, r + 11, esc(k.name).toUpperCase(), 'tt-tname', { 'text-anchor': 'middle' });
  });

  // Motion-Tracker-Pings
  const pl = el('g', { class: 'tt-pings' }, g);
  t.pings.filter((p) => p.levelId === lv.id && (p.keep || Date.now() - p.t < PING_MS)).forEach((p) => {
    const pg = el('g', { class: 'tt-ping', 'data-ping': p.id, transform: `translate(${p.x} ${p.y})` }, pl);
    el('circle', { r: 26, class: 'tt-pwave' }, pg);
    el('circle', { r: 26, class: 'tt-pwave w2' }, pg);
    el('circle', { r: 7, class: 'tt-pdot' }, pg);
  });
  return info;
}
