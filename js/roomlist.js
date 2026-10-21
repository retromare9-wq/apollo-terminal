// Raumliste der Handy-App (Alien-RPG) im Karten-Editor: lokal gespeichert, über ein
// privates GitHub Gist abgeglichen (sync.js) und per Ebene + Raum-ID an die Räume der Karte gekoppelt.
import { createRoomSync, touchFields } from './sync.js';

const KEY = 'apollo.roomlist.v1';
export const TERMINAL_PICTO = 26; // Semiotic Standard „COMPUTER TERMINAL“

// Felder der Raumbeschreibung in der Raumliste (gleiche Namen wie in der Handy-App)
export const LIST_TEXT_FIELDS = [
  ['aesthetics', 'ALLGEMEINE ÄSTHETIK & DESIGNPRINZIPIEN'],
  ['smell', 'WAS RIECHT MAN'],
  ['look', 'WAS SIEHT MAN'],
  ['sound', 'WAS HÖRT MAN'],
  ['investigate', 'WAS ERFÄHRT/FINDET MAN NACH GENAUERER UNTERSUCHUNG'],
  ['interaction', 'INTERAKTION'],
  ['items', 'WAS FÜR GEGENSTÄNDE FINDET MAN'],
  ['notes', 'NOTIZEN FÜR DIE GM'],
];

let cache = null;
const listeners = [];

function load() {
  if (!cache) {
    try { cache = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { cache = []; }
    if (!Array.isArray(cache)) cache = [];
  }
  return cache;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* egal */ }
}

export const roomListEntries = () => load().filter((r) => !r.deleted);
export const roomListEmpty = () => roomListEntries().length === 0;
export const onRoomListChange = (fn) => listeners.push(fn);

export const roomSync = createRoomSync({
  load: () => load().map((r) => ({ ...r })),
  save: (rooms) => { cache = rooms; persist(); },
  canCreate: false, // Ausgangspunkt ist die Raumliste der Handy-App
  onRemoteChange: () => listeners.forEach((fn) => fn('remote')),
  onStatus: (s) => listeners.forEach((fn) => fn('status', s)),
});

const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function updateEntry(id, patch) {
  const list = load();
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  list[i] = touchFields(list[i], { ...list[i], ...patch });
  persist();
  roomSync.changed();
  return list[i];
}

export function addEntry(entry) {
  const e = touchFields(null, {
    id: uid(), area: '', subarea: '', name: '', roomId: '', level: '0',
    cluttered: true, terminal: false, shafts: 0, doors: 0, core: false,
    aesthetics: '', smell: '', look: '', sound: '', investigate: '', interaction: '', items: '', notes: '',
    ...entry,
  });
  load().push(e);
  persist();
  roomSync.changed();
  return e;
}

// ---------- Kopplung Karte ↔ Raumliste ----------

const lc = (s) => String(s ?? '').trim().toLowerCase();
export const mapLinkOf = (levelId, room) => `${levelId}:${room.id}`;

// Passender Eintrag für einen Raum der Karte: zuerst über die gespeicherte Verknüpfung,
// sonst über Ebene + Raum-ID (bei Quartieren ohne ID über das versteckte Feld linkId).
// Gibt es die ID auf der Ebene mehrfach (z. B. K1), entscheidet der Bereich.
export function findEntry({ levelId, levelNo, room, code, zone }) {
  const list = roomListEntries();
  const link = mapLinkOf(levelId, room);
  const direct = list.find((r) => r.mapLink === link);
  if (direct) return direct;
  if (levelNo == null) return null;
  const c = lc(code);
  const hits = list.filter((r) => !r.mapLink && String(r.level) === String(levelNo) && c && (lc(r.roomId) === c || lc(r.linkId) === c));
  if (hits.length <= 1) return hits[0] || null;
  const z = lc(zone);
  return hits.find((r) => z && [r.subarea, r.area].some((a) => lc(a) && (z.includes(lc(a)) || lc(a).includes(z)))) || hits[0];
}

// Einträge derselben Ebene, die noch an keinen Raum der Karte gekoppelt sind (zum manuellen Verknüpfen)
export function unlinkedEntries(levelNo, linkedIds) {
  return roomListEntries()
    .filter((r) => String(r.level) === String(levelNo) && !linkedIds.has(r.id))
    .sort((a, b) => String(a.area).localeCompare(String(b.area), 'de') || String(a.roomId || '~').localeCompare(String(b.roomId || '~'), 'de', { numeric: true }));
}
