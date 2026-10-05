// Ausrüstungsliste für den Editor: Katalog aus der Alien-RPG-App plus eigene Einträge/Änderungen.
import { CATALOG, CATEGORIES } from './equipment-data.js';

const KEY = 'apollo.equipment.v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { custom: [], edits: {}, hidden: [], ...JSON.parse(raw) };
  } catch { /* ohne Speicher weiter */ }
  return { custom: [], edits: {}, hidden: [] };
}
let state = read();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* egal */ } };

export function equipmentList() {
  const base = CATALOG.filter((it) => !state.hidden.includes(it.id)).map((it) => ({ ...it, ...(state.edits[it.id] || {}), base: true }));
  return [...base, ...state.custom.map((it) => ({ ...it, base: false }))]
    .sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}

export function equipmentCategories() {
  return [...new Set([...CATEGORIES, ...state.custom.map((i) => i.cat)])];
}

export function saveItem(item) {
  const clean = { name: item.name.trim(), cat: item.cat.trim() || 'Other Equipment', weight: item.weight || '', cost: item.cost || '', effect: item.effect || '' };
  if (!clean.name) return null;
  if (item.id && CATALOG.some((c) => c.id === item.id)) {
    state.edits[item.id] = clean;
  } else if (item.id) {
    const i = state.custom.findIndex((c) => c.id === item.id);
    if (i >= 0) state.custom[i] = { ...state.custom[i], ...clean };
  } else {
    const id = `custom-${Date.now().toString(36)}`;
    state.custom.push({ id, kind: 'gear', source: 'Eigene', ...clean });
    item = { id };
  }
  save();
  return item.id;
}

export function deleteItem(id) {
  if (CATALOG.some((c) => c.id === id)) state.hidden.push(id);
  else state.custom = state.custom.filter((c) => c.id !== id);
  delete state.edits[id];
  save();
}

export function exportEquipment() { return JSON.parse(JSON.stringify(state)); }
export function importEquipment(data) {
  if (!data || typeof data !== 'object') return;
  state = { custom: [], edits: {}, hidden: [], ...data };
  save();
}
