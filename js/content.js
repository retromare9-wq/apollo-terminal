// Bearbeitbare Terminal-Inhalte: Vorgaben aus data.js, überschrieben durch den Editor.
// Die exportierten Objekte aus data.js werden an Ort und Stelle geändert, damit alle
// Module automatisch die aktuellen Inhalte sehen.
import { CONFIG, TOPICS, MENU, PERSONNEL, DEMO_REPLIES } from './data.js';

export const CONTENT_KEY = 'apollo.content.v1';
const clone = (o) => JSON.parse(JSON.stringify(o));

const DEFAULTS = clone({ config: CONFIG, topics: TOPICS, menu: MENU, personnel: PERSONNEL, replies: DEMO_REPLIES });

export function defaultContent() { return clone(DEFAULTS); }

export function currentContent() {
  return clone({ config: CONFIG, topics: TOPICS, menu: MENU, personnel: PERSONNEL, replies: DEMO_REPLIES });
}

function replaceArray(target, items) { target.splice(0, target.length, ...items); }
function replaceObject(target, src) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, src);
}

export function applyContent(c) {
  const d = defaultContent();
  replaceObject(CONFIG, { ...d.config, ...(c?.config || {}) });
  replaceArray(TOPICS, Array.isArray(c?.topics) ? c.topics : d.topics);
  replaceArray(MENU, Array.isArray(c?.menu) ? c.menu : d.menu);
  replaceArray(PERSONNEL, Array.isArray(c?.personnel) ? c.personnel : d.personnel);
  replaceArray(DEMO_REPLIES, Array.isArray(c?.replies) ? c.replies : d.replies);
}

export function loadContent() {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) { applyContent(JSON.parse(raw)); return true; }
  } catch { /* ohne Speicher: Vorgaben */ }
  return false;
}

export function saveContent(c) {
  try { localStorage.setItem(CONTENT_KEY, JSON.stringify(c)); } catch { /* ignorieren */ }
  applyContent(c);
}

export function resetContent() {
  try { localStorage.removeItem(CONTENT_KEY); } catch { /* ignorieren */ }
  applyContent(defaultContent());
}
