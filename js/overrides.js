// Änderungen aus dem Bearbeitungsmodus (Status, Kameras) – lokal im Browser gespeichert.
// Vorgaben stehen in data.js (STATION.status) bzw. kommen aus der Zeichnung (room.cams).

const KEY = 'apollo.station.overrides.v1';
export const STATUSES = ['', 'warn', 'damage', 'offline', 'sealed'];

let ov = { status: {}, cams: {} };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) ov = { status: {}, cams: {}, ...JSON.parse(raw) };
} catch { /* ohne Speicher weiterarbeiten */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(ov)); } catch { /* ignorieren */ }
}

export function statusOf(station, id) {
  const s = id in ov.status ? ov.status[id] : station.status[id];
  return s || '';
}

export function camsOf(room) {
  return room.id in ov.cams ? ov.cams[room.id] : room.cams || 0;
}

export function cycleStatus(station, id) {
  const next = STATUSES[(STATUSES.indexOf(statusOf(station, id)) + 1) % STATUSES.length];
  ov.status[id] = next;
  save();
  return next;
}

export function toggleCams(room) {
  ov.cams[room.id] = camsOf(room) > 0 ? 0 : Math.max(1, room.cams || 0);
  save();
  return ov.cams[room.id];
}

export function resetOverrides() {
  ov = { status: {}, cams: {} };
  save();
}
