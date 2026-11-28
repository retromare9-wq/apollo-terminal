// Spieltisch: GM-Karte (Laptop) und Spielerkarte (Fernseher/Beamer).
// Tokens, Notizen, Motion-Tracker-Pings, Piktogramme, aufgedeckte Türen und freigegebene Kameras
// liegen im Browser (localStorage) und werden zwischen den Fenstern live abgeglichen.

import { CONFIG } from './data.js';
import { el, txt } from './svg.js';
import { drawStationPlan, roomName, roomCode, roomZone, bbox } from './stationplan.js';
import { loadLayer } from './layer.js';
import { loadPlans, asLevel, levelNum, LAYER_FALLBACK, uid } from './plans.js';
import { findEntry } from './roomlist.js';
import { semioticById } from './semiotic.js';

export const TABLE_KEY = 'apollo.table.v1';
export const PING_MS = 20000;
export const TOKEN_R = 14;                 // Radius in Karteneinheiten (≈ 1,4 m Durchmesser)
export const PICTO_SIZE = 24;
export const KINDS = {
  pc: 'SC', npc: 'NSC', cultcore: 'KERNKULT', cult: 'KULT', prisks: 'GEF. IN KS', prislh: 'GEF. IN LH',
  alien: 'XENO', other: 'SONSTIGE', group: 'GRUPPE',
};
export const KIND_COLOR = {
  pc: '#3fa9f5', npc: '#e3cb5c', cultcore: '#a63de0', cult: '#d38cf5', prisks: '#ff8c2a', prislh: '#2ad1c9',
  alien: '#e43a24', other: '#9a9a9a', group: '#f2f2f2',
};
export { uid };

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('apollo-table') : null;

export function emptyTable() {
  return { tokens: [], notes: [], pings: [], pictos: [], pictoNames: {}, rpics: {}, doors: {}, cams: {}, player: null, follow: false };
}

export function loadTable() {
  let t = null;
  try { t = JSON.parse(localStorage.getItem(TABLE_KEY) || 'null'); } catch { /* leer */ }
  t = { ...emptyTable(), ...(t || {}) };
  for (const k of ['tokens', 'notes', 'pings', 'pictos']) if (!Array.isArray(t[k])) t[k] = [];
  for (const k of ['doors', 'cams', 'pictoNames', 'rpics']) if (!t[k] || typeof t[k] !== 'object') t[k] = {};
  t.pings = t.pings.filter((p) => p.keep || Date.now() - p.t < PING_MS);
  return t;
}

// quiet: nur speichern, das andere Fenster nicht neu zeichnen lassen
export function saveTable(t, quiet = false) {
  try { localStorage.setItem(TABLE_KEY, JSON.stringify(t)); } catch { return false; }
  if (!quiet) notifyChange();
  return true;
}
export const notifyChange = () => channel?.postMessage('changed');

// Ausschnitt live übertragen (Mitlaufen), ohne die Karte neu aufzubauen
export const postView = (v) => channel?.postMessage({ type: 'view', levelId: v.levelId, vb: v.vb });
// Laserpointer: leuchtender Punkt, Größe unabhängig vom Zoom
export function laserNode(svg) {
  let n = svg.querySelector(':scope > .tt-laser');
  if (!n) {
    n = el('g', { class: 'tt-laser', style: 'display:none' }, svg);
    el('circle', { r: 18, class: 'tt-lglow' }, n);
    el('circle', { r: 9, class: 'tt-lring' }, n);
    el('circle', { r: 4.5, class: 'tt-lcore' }, n);
  }
  return n;
}
export function placeLaser(svg, l) {
  const n = laserNode(svg);
  if (!l?.on || l.x == null) { n.style.display = 'none'; return; }
  const vb = svg.viewBox.baseVal;
  const r = svg.getBoundingClientRect();
  const k = vb && vb.width ? Math.max(vb.width / (r.width || 1), vb.height / (r.height || 1)) : 1;
  n.setAttribute('transform', `translate(${l.x} ${l.y}) scale(${k.toFixed(4)})`);
  n.style.display = '';
}
// Laserpointer: Position live an die Spielerkarte
export const postLaser = (l) => channel?.postMessage({ type: 'laser', ...l });
export function onLaser(fn) {
  channel?.addEventListener('message', (e) => { if (e.data?.type === 'laser') fn(e.data); });
}
export function onView(fn) {
  channel?.addEventListener('message', (e) => { if (e.data?.type === 'view') fn(e.data); });
}

// Änderungen aus dem anderen Fenster (GM ↔ Spieler, Editor)
export function onTableChange(fn) {
  channel?.addEventListener('message', (e) => { if (e.data === 'changed') fn(); });
  addEventListener('storage', (e) => {
    const k = e.key || '';
    if (k === TABLE_KEY || k.startsWith('apollo.map.') || k === 'apollo.plans.v1' || k === 'apollo.roomlist.v1') fn();
  });
}

// Alle Ebenen aller Karten (Reihenfolge wie im Editor)
export function allLevels() {
  const plans = loadPlans();
  return plans.maps.flatMap((m) => m.levels.map((l) => ({ id: l.id, mapId: m.id, mapName: m.name, terminal: m.terminal, plan: asLevel(m, l) })));
}

export const startLevel = (levels) => levels.find((l) => l.terminal && levelNum(l.plan.name) === 0) || levels.find((l) => l.terminal) || levels[0];

export const tableLayer = (lv) => loadLayer(lv.id, LAYER_FALLBACK[lv.id]);

// Eintrag der Raumliste zu einem Raum (falls vorhanden)
export function roomEntry(lv, room, layer) {
  try { return findEntry({ levelId: lv.id, levelNo: levelNum(lv.plan.name), room, code: roomCode(room, layer), zone: roomZone(lv.plan, room, layer) }); } catch { return null; }
}

// Raum-ID und Name: Raumliste (falls verknüpft), sonst Kartendaten
export function roomLabel(lv, room, layer) {
  const e = roomEntry(lv, room, layer);
  return { code: String(e?.roomId || roomCode(room, layer)).toUpperCase(), name: String(e?.name || roomName(lv.plan, room, layer)).toUpperCase(), entry: e };
}

export const pictoName = (t, sym) => t.pictoNames?.[sym] || semioticById(sym)?.de || '';

// Umriss je Art: SC Kreis, NSC (auch Kult und Gefangene) Quadrat, Xeno umgedrehtes Dreieck, Gruppe Sechseck
export const SHAPE_OF = (kind) => (kind === 'pc' || kind === 'other' || !kind ? 'circle'
  : kind === 'alien' ? 'tri' : kind === 'group' ? 'hex' : 'square');
export function tokenShape(kind, r) {
  const sh = SHAPE_OF(kind);
  if (sh === 'square') { const s = r * 0.9; return { tag: 'rect', a: { x: -s, y: -s, width: s * 2, height: s * 2, rx: 1.5 } }; }
  if (sh === 'tri') return { tag: 'path', a: { d: `M${-r * 1.2} ${-r * 0.8} L${r * 1.2} ${-r * 0.8} L0 ${r * 1.3} Z`, 'stroke-linejoin': 'round' } };
  if (sh === 'hex') {
    const R = r * 1.12;
    const pts = [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 3) * i; return `${(R * Math.cos(a)).toFixed(2)} ${(R * Math.sin(a)).toFixed(2)}`; });
    return { tag: 'path', a: { d: `M${pts.join(' L')} Z`, 'stroke-linejoin': 'round' } };
  }
  return { tag: 'circle', a: { r } };
}
export const groupMembers = (t, g) => t.tokens.filter((k) => k.group === g.id && k.id !== g.id);
// Raum-Piktogramm für Spieler freigegeben?
export const rpicKey = (roomId, pid) => `${roomId}:${pid}`;
export const rpicShown = (t, levelId, roomId, pid) => !!t.rpics?.[levelId]?.[rpicKey(roomId, pid)];

const str = (s) => String(s ?? '');

// Karte samt Spieltisch-Objekten zeichnen. mode: 'gm' | 'player'
export function drawTable(svg, lv, t, mode) {
  svg.replaceChildren();
  const g = el('g', { class: `tt tt-${mode}` }, svg);
  const layer = tableLayer(lv);
  const info = drawStationPlan(g, CONFIG, lv.plan, layer, { cams: true });
  const objs = info.plan.objects;
  const defs = el('defs', {}, g);

  // Türen: für Spieler grau, bis die Farbe freigegeben ist
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

  // Piktogramme der Räume (aus dem Editor): für Spieler nur freigegebene
  g.querySelectorAll('.st-picto[data-room]').forEach((n) => {
    if (rpicShown(t, lv.id, n.dataset.room, n.dataset.pid)) return;
    if (mode === 'player') n.remove(); else n.classList.add('pic-off');
  });

  // Raum-ID in jedem Raum (Raumnamen stehen nicht auf der Karte)
  const rl = el('g', { class: 'tt-rooms' }, g);
  lv.plan.rooms.forEach((room) => {
    const b = bbox(room.rects);
    const w = b[2] - b[0];
    const h = b[3] - b[1];
    const { code } = roomLabel(lv, room, layer);
    const fs = Math.max(5, Math.min(13, (w / Math.max(3, code.length)) * 1.3, h / 2.6));
    txt(rl, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2 + fs * 0.35, code, 'tt-rcode', { 'text-anchor': 'middle', style: `font-size:${fs.toFixed(1)}px` });
  });

  // Piktogramme (frei gesetzt)
  const pg = el('g', { class: 'tt-pictos' }, g);
  t.pictos.filter((p) => p.levelId === lv.id && (mode === 'gm' || p.visible)).forEach((p) => {
    const s = semioticById(p.sym);
    if (!s) return;
    const size = Number(p.size) || PICTO_SIZE;
    const ig = el('g', { class: `tt-picto${p.visible ? '' : ' gm-only'}`, 'data-picto': p.id, transform: `translate(${p.x} ${p.y})` }, pg);
    el('title', {}, ig).textContent = pictoName(t, p.sym);
    el('rect', { x: -size / 2 - 2, y: -size / 2 - 2, width: size + 4, height: size + 4, class: 'tt-pictobox' }, ig);
    const inner = el('g', { transform: `translate(${-size / 2} ${-size / 2}) scale(${size / 100})` }, ig);
    inner.innerHTML = s.svg;
  });

  // Notizen
  const nl = el('g', { class: 'tt-notes' }, g);
  t.notes.filter((n) => n.levelId === lv.id && (mode === 'gm' || n.visible)).forEach((n) => {
    const ng = el('g', { class: `tt-note${n.visible ? '' : ' gm-only'}`, 'data-note': n.id, transform: `translate(${n.x} ${n.y})` }, nl);
    el('circle', { r: 5, class: 'tt-pin', fill: n.color || '#e3cb5c' }, ng);
    const lines = str(n.text).split('\n').slice(0, 6);
    const width = Math.max(...lines.map((l) => l.length), 4) * 5.6 + 12;
    el('rect', { x: 8, y: -9, width, height: lines.length * 11 + 8, rx: 2, class: 'tt-notebox', stroke: n.color || '#e3cb5c' }, ng);
    lines.forEach((l, i) => txt(ng, 14, 3 + i * 11, l, 'tt-notetext'));
  });

  // Tokens
  const tl = el('g', { class: 'tt-tokens' }, g);
  t.tokens.filter((k) => k.levelId === lv.id && (mode === 'gm' || !k.hidden)).forEach((k) => {
    const sz = Number(k.size) || 1;
    const r = TOKEN_R * sz;
    const lab = Math.max(0.7, Math.min(1, sz));
    const color = k.color || KIND_COLOR[k.kind] || '#e3cb5c';
    const shape = tokenShape(k.kind, r);
    const tg = el('g', { class: `tt-token k-${k.kind}${k.hidden ? ' hidden' : ''}`, 'data-token': k.id, transform: `translate(${k.x} ${k.y})` }, tl);
    if (k.img) {
      const cid = `tclip-${k.id}`;
      const cp = el('clipPath', { id: cid }, defs);
      el(shape.tag, shape.a, cp);
      el(shape.tag, { ...shape.a, fill: '#000' }, tg);
      el('image', { href: k.img, x: -r * 1.2, y: -r * 1.2, width: r * 2.4, height: r * 2.4, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${cid})` }, tg);
    } else {
      el(shape.tag, { ...shape.a, fill: color, class: 'tt-tfill' }, tg);
      const short = str(k.short || k.name).replace(/[^A-Za-zÄÖÜäöü0-9]/g, '').slice(0, 2).toUpperCase();
      const xeno = k.kind === 'alien';
      txt(tg, 0, xeno ? -r * 0.05 : r * 0.32, short, 'tt-tshort', { 'text-anchor': 'middle', style: `font-size:${(r * (xeno ? 0.75 : 0.9)).toFixed(1)}px` });
    }
    el(shape.tag, { ...shape.a, fill: 'none', stroke: color, 'stroke-width': (3 * Math.min(1, sz)).toFixed(2), class: 'tt-ring' }, tg);
    if (k.kind === 'group') {
      const ms = groupMembers(t, k);
      el('title', {}, tg).textContent = `${k.name}: ${ms.map((m) => m.name).join(', ') || 'keine Mitglieder'}`;
      if (ms.length) {
        const bx = r * 0.95;
        el('circle', { cx: bx, cy: -bx, r: Math.max(4, r * 0.42), class: 'tt-badge' }, tg);
        txt(tg, bx, -bx + Math.max(4, r * 0.42) * 0.38, String(ms.length), 'tt-badget', { 'text-anchor': 'middle', style: `font-size:${(Math.max(4, r * 0.42) * 1.1).toFixed(1)}px` });
      }
    }
    const ny = (k.kind === 'alien' ? r * 1.3 : r) + 4 + 7 * lab;
    txt(tg, 0, ny, str(k.name).toUpperCase(), 'tt-tname', { 'text-anchor': 'middle', style: `font-size:${(10 * lab).toFixed(1)}px` });
  });

  // Motion-Tracker-Pings
  const pl = el('g', { class: 'tt-pings' }, g);
  t.pings.filter((p) => p.levelId === lv.id && (p.keep || Date.now() - p.t < PING_MS)).forEach((p) => {
    const pgr = el('g', { class: `tt-ping${p.keep ? ' keep' : ''}`, 'data-ping': p.id, transform: `translate(${p.x} ${p.y})` }, pl);
    el('circle', { r: 26, class: 'tt-pwave' }, pgr);
    el('circle', { r: 26, class: 'tt-pwave w2' }, pgr);
    el('circle', { r: 7, class: 'tt-pdot' }, pgr);
  });
  return info;
}
