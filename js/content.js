// Bearbeitbare Terminal-Inhalte: Vorgaben aus data.js, überschrieben durch den Editor.
// Die exportierten Objekte aus data.js werden an Ort und Stelle geändert, damit alle
// Module automatisch die aktuellen Inhalte sehen.
import { CONFIG, TOPICS, MENU, PERSONNEL, DEMO_REPLIES, COMMLOG, SYSTEMS, SELFDESTRUCT } from './data.js';

export const CONTENT_KEY = 'apollo.content.v1';
const VERSION = 2;
const clone = (o) => JSON.parse(JSON.stringify(o));

const snapshot = () => ({
  v: VERSION,
  config: CONFIG,
  topics: TOPICS,
  menu: MENU,
  personnel: PERSONNEL,
  replies: DEMO_REPLIES,
  commlog: COMMLOG,
  systems: SYSTEMS,
  selfdestruct: SELFDESTRUCT,
});

const DEFAULTS = clone(snapshot());

export function defaultContent() { return clone(DEFAULTS); }

export function currentContent() { return clone(snapshot()); }

function replaceArray(target, items) { target.splice(0, target.length, ...items); }
function replaceObject(target, src) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, src);
}

// Ältere Speicherstände: Zugangsstufen und neue Kategorien ergänzen
function migrate(c, d) {
  const topics = Array.isArray(c.topics) ? c.topics : d.topics;
  for (const t of topics) {
    if (!t.access) t.access = d.topics.find((x) => x.id === t.id)?.access || 'orange';
  }
  for (const t of d.topics) if (!topics.some((x) => x.id === t.id)) topics.splice(topics.length - (topics.at(-1)?.id === 'hilfe' ? 1 : 0), 0, t);
  let menu = Array.isArray(c.menu) ? c.menu : d.menu;
  if ((c.v || 1) < 2 && Array.isArray(c.menu)) {
    const add = d.menu.filter((m) => !menu.some((x) => x.topic === m.topic));
    const hi = menu.findIndex((m) => m.topic === 'hilfe');
    menu = hi >= 0 ? [...menu.slice(0, hi), ...add, ...menu.slice(hi)] : [...menu, ...add];
  }
  return { topics, menu };
}

export function applyContent(c) {
  const d = defaultContent();
  const { topics, menu } = migrate(c || {}, d);
  replaceObject(CONFIG, { ...d.config, ...(c?.config || {}) });
  if (CONFIG.starmap) CONFIG.starmap = { systems: {}, sectors: {}, ...CONFIG.starmap };
  replaceArray(TOPICS, topics);
  replaceArray(MENU, menu);
  replaceArray(PERSONNEL, Array.isArray(c?.personnel) ? c.personnel : d.personnel);
  replaceArray(DEMO_REPLIES, Array.isArray(c?.replies) ? c.replies : d.replies);
  replaceArray(COMMLOG, Array.isArray(c?.commlog) ? c.commlog : d.commlog);
  replaceArray(SYSTEMS, Array.isArray(c?.systems) ? c.systems : d.systems);
  replaceObject(SELFDESTRUCT, { ...d.selfdestruct, ...(c?.selfdestruct || {}) });
}

export function loadContent() {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) { applyContent(JSON.parse(raw)); return true; }
  } catch { /* ohne Speicher: Vorgaben */ }
  return false;
}

export function saveContent(c) {
  try { localStorage.setItem(CONTENT_KEY, JSON.stringify({ ...c, v: VERSION })); } catch { /* ignorieren */ }
  applyContent({ ...c, v: VERSION });
}

export function resetContent() {
  try { localStorage.removeItem(CONTENT_KEY); } catch { /* ignorieren */ }
  applyContent(defaultContent());
}
