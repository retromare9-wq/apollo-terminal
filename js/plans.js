// Karten (Grundrisse) aus dem Editor: mehrere Karten mit je mehreren Ebenen.
// Jede Ebene hat einen Grundriss (Räume, Korridore, Aufzüge, Beschriftungen) und eine
// editierbare Schicht (Türen, Kameras, Raumdaten – siehe layer.js, eigener Speicher je Ebene).
//
// Maßstab: 20 Einheiten = 1 m. Millimeterpapier mit 1 cm = 5 m → 1 mm = 0,5 m = 10 Einheiten.

import { LEVEL0 } from './station-level0.js';
import { LAYER0 } from './station-layer0.js';

export const PLANS_KEY = 'apollo.plans.v1';
export const MM = 10;                 // Einheiten pro Millimeter Papier
export const SNAP = 10;               // Einrasten: auf jeden Millimeter des Rasters
export const CORR_W = { narrow: 30, wide: 50 };   // 1,5 m und 2,5 m

// Vorgabe der editierbaren Schicht je Ebene (sonst leer)
export const LAYER_FALLBACK = { level0: LAYER0 };

const clone = (o) => JSON.parse(JSON.stringify(o));

export const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyPlan(name = 'LEVEL 0') {
  return { name, zones: {}, rooms: [], corridors: [], lifts: [], labels: [] };
}

// Alter, digitalisierter Grundriss → bearbeitbare Ebene
function fromLegacy(L) {
  const p = clone(L);
  delete p.doors;
  delete p.bounds;
  const exit = p.corridors.concat(p.rooms.flatMap((r) => r.rects)).reduce((m, c) => (c[2] > m[2] ? c : m));
  p.labels = [...p.labels.map((l, i) => ({ id: `lbl${i}`, ...l })),
    { id: 'lbl-exit', text: 'ZUM FLUGFELD ▶', x: exit[2] + 30, y: (exit[1] + exit[3]) / 2 }];
  return p;
}

export function defaultPlans() {
  return {
    maps: [{
      id: 'station', name: 'ON-TWEX9', terminal: true, narrow: CORR_W.narrow, wide: CORR_W.wide,
      levels: [{ id: 'level0', plan: fromLegacy(LEVEL0) }],
    }],
  };
}

function normPlan(p, name) {
  const e = emptyPlan(name);
  const out = { ...e, ...(p || {}) };
  for (const k of ['rooms', 'corridors', 'lifts', 'labels']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.zones || typeof out.zones !== 'object') out.zones = {};
  out.rooms.forEach((r) => { r.lines = r.lines || []; r.zone = r.zone || ''; });
  return out;
}

export function normPlans(data) {
  const maps = Array.isArray(data?.maps) && data.maps.length ? data.maps : defaultPlans().maps;
  return {
    maps: maps.map((m) => ({
      id: m.id || uid('m'),
      name: m.name || 'KARTE',
      terminal: m.terminal !== false,
      narrow: Number(m.narrow) && Number(m.narrow) !== 25 ? Number(m.narrow) : CORR_W.narrow,   // alte Vorgabe 1,25 m → 1,5 m
      wide: Number(m.wide) || CORR_W.wide,
      levels: (Array.isArray(m.levels) && m.levels.length ? m.levels : [{ id: uid('l'), plan: emptyPlan() }])
        .map((l) => ({ id: l.id || uid('l'), plan: normPlan(l.plan, l.plan?.name) })),
    })),
  };
}

export function loadPlans() {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (raw) return normPlans(JSON.parse(raw));
  } catch { /* Vorgabe */ }
  return defaultPlans();
}

export function savePlans(plans) {
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(plans)); return true; } catch { return false; }
}

// Ausdehnung eines Grundrisses
export function planBounds(p) {
  const rects = [...p.corridors, ...p.rooms.flatMap((r) => r.rects), ...p.lifts.map((l) => l.rect)];
  if (!rects.length) return [0, 0, 1000, 600];
  return rects.reduce((b, r) => [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])],
    [Infinity, Infinity, -Infinity, -Infinity]);
}

// Ebene für die Darstellung vorbereiten (Ausdehnung, Kartenname)
export function asLevel(map, lvl) {
  const plan = lvl.plan;
  plan.bounds = planBounds(plan);
  plan.mapName = map.name;
  return plan;
}

// Alle Ebenen der Karten, die im Terminal erscheinen – in Reihenfolge
export function terminalLevels(plans = loadPlans()) {
  const out = [];
  for (const map of plans.maps) {
    if (!map.terminal) continue;
    for (const lvl of map.levels) out.push({ id: lvl.id, mapId: map.id, plan: asLevel(map, lvl), layer: LAYER_FALLBACK[lvl.id] });
  }
  return out;
}
