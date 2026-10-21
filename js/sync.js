// Raumliste über ein privates GitHub Gist zwischen Handy-App (Alien-RPG) und
// Karten-Editor (apollo-terminal) abgleichen. Diese Datei ist in beiden Projekten identisch.
//
// Jeder Raum hat `id` und `updatedAt`; beim Abgleich gewinnt je Raum die neuere Fassung.
// Gelöschte Räume bleiben als { id, deleted: true, updatedAt } erhalten, damit das
// Löschen auch auf dem anderen Gerät ankommt.

export const SYNC_FILE = 'oxi-neroponti-raumliste.json';
const SETTINGS_KEY = 'alien-rpg-sync';
const API = 'https://api.github.com';
const POLL_MS = 30000;
const PUSH_DELAY_MS = 1500;

export function syncSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* egal */ }
}

// ---------- Zusammenführen ----------
// Je Feld gewinnt die neuere Änderung (fieldTimes: { feld: Zeitstempel }). So gehen keine
// Eingaben verloren, wenn beide Geräte kurz nacheinander verschiedene Felder desselben Raums ändern.

const stamp = (r) => Number(r?.updatedAt) || 0;
const META = new Set(['id', 'updatedAt', 'fieldTimes', 'deleted']);

// Änderungszeiten der Felder fortschreiben, die sich gegenüber `before` geändert haben
export function touchFields(before, after, now = Date.now()) {
  const times = { ...(before?.fieldTimes || {}) };
  for (const k of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
    if (META.has(k)) continue;
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after[k])) times[k] = now;
  }
  return { ...after, fieldTimes: times, updatedAt: now };
}

function mergeOne(a, b) {
  if (a.deleted || b.deleted) return stamp(a) >= stamp(b) ? a : b;
  const fa = a.fieldTimes || {};
  const fb = b.fieldTimes || {};
  const out = { id: a.id };
  const times = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (META.has(k)) continue;
    const ta = fa[k] || 0;
    const tb = fb[k] || 0;
    const useB = tb > ta || !(k in a);
    out[k] = useB ? b[k] : a[k];
    if (Math.max(ta, tb)) times[k] = Math.max(ta, tb);
  }
  out.fieldTimes = times;
  out.updatedAt = Math.max(stamp(a), stamp(b));
  return out;
}

export function mergeRooms(local, remote) {
  const byId = new Map();
  for (const r of remote || []) if (r?.id) byId.set(r.id, r);
  for (const l of local || []) {
    if (!l?.id) continue;
    const r = byId.get(l.id);
    byId.set(l.id, r ? mergeOne(l, r) : l);
  }
  return [...byId.values()];
}

const canon = (list) => JSON.stringify([...(list || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
export const sameRooms = (a, b) => canon(a) === canon(b);

// ---------- GitHub-API ----------

async function api(token, path, { method = 'GET', body, etag } = {}) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (res.status === 304) return { notModified: true };
  if (res.status === 401) throw new Error('Token ungültig oder abgelaufen.');
  if (res.status === 403 || res.status === 404) throw new Error('Kein Zugriff – hat der Token das Recht „gist“?');
  if (!res.ok) throw new Error(`GitHub antwortet mit Fehler ${res.status}.`);
  return { data: await res.json(), etag: res.headers.get('ETag') };
}

async function readGistFile(file) {
  if (!file) return null;
  const text = file.truncated ? await (await fetch(file.raw_url, { cache: 'no-store' })).text() : file.content;
  const doc = JSON.parse(text);
  return Array.isArray(doc?.rooms) ? doc.rooms : [];
}

const docOf = (rooms) => JSON.stringify({ format: 'alien-rpg-raumliste', version: 1, savedAt: new Date().toISOString(), rooms }, null, 1);

async function findGist(token) {
  for (let page = 1; page <= 5; page++) {
    const { data } = await api(token, `/gists?per_page=100&page=${page}`);
    const hit = data.find((g) => g.files && g.files[SYNC_FILE]);
    if (hit) return hit.id;
    if (data.length < 100) break;
  }
  return null;
}

// ---------- Steuerung ----------

// load(): lokale Räume (inkl. gelöschter); save(rooms): lokal speichern;
// onRemoteChange(): nach Übernahme fremder Änderungen; onStatus(status); canCreate: darf ein neues Gist anlegen.
export function createRoomSync({ load, save, onRemoteChange = () => {}, onStatus = () => {}, canCreate = false }) {
  let status = { state: 'off', message: 'Nicht eingerichtet', lastSync: 0 };
  let running = null;
  let again = false;
  let pushTimer = 0;
  let pollTimer = 0;
  let etag = null;
  let remoteCache = null;

  const setStatus = (s) => { status = { ...status, ...s }; onStatus(status); };

  async function syncNow() {
    const { token, gistId } = syncSettings();
    if (!token || !gistId) { setStatus({ state: 'off', message: 'Nicht eingerichtet' }); return; }
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        setStatus({ state: 'syncing', message: 'Abgleich …' });
        const res = await api(token, `/gists/${gistId}`, { etag: remoteCache ? etag : null });
        if (!res.notModified) {
          remoteCache = await readGistFile(res.data.files[SYNC_FILE]) || [];
          etag = res.etag;
        }
        const local = load();
        const merged = mergeRooms(local, remoteCache);
        if (!sameRooms(merged, local)) { save(merged); onRemoteChange(); }
        if (!sameRooms(merged, remoteCache)) {
          await api(token, `/gists/${gistId}`, { method: 'PATCH', body: { files: { [SYNC_FILE]: { content: docOf(merged) } } } });
          remoteCache = merged;
          etag = null;
        }
        setStatus({ state: 'ok', message: 'Synchron', lastSync: Date.now() });
      } catch (err) {
        setStatus({ state: 'error', message: err.message || 'Keine Verbindung' });
      } finally {
        running = null;
        if (again) { again = false; syncNow(); }
      }
    })();
    return running;
  }

  function start() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden) syncNow(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
    addEventListener('online', () => syncNow());
    syncNow();
  }

  // Nach jeder lokalen Änderung aufrufen: lädt kurz danach hoch.
  function changed() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, PUSH_DELAY_MS);
  }

  // Token prüfen, vorhandenes Gist suchen oder (falls erlaubt) mit der lokalen Liste anlegen.
  async function connect(token) {
    token = String(token || '').trim();
    if (!token) throw new Error('Bitte einen Token eintragen.');
    setStatus({ state: 'syncing', message: 'Verbinde …' });
    try {
      let gistId = await findGist(token);
      if (!gistId) {
        if (!canCreate) throw new Error('Noch keine Raumliste auf GitHub. Bitte zuerst in der Handy-App einrichten.');
        const { data } = await api(token, '/gists', {
          method: 'POST',
          body: { description: 'Oxi-Neroponti Raumliste (Alien RPG)', public: false, files: { [SYNC_FILE]: { content: docOf(load()) } } },
        });
        gistId = data.id;
      }
      saveSettings({ token, gistId });
      etag = null;
      remoteCache = null;
      await syncNow();
      return gistId;
    } catch (err) {
      setStatus({ state: 'error', message: err.message });
      throw err;
    }
  }

  function disconnect() {
    saveSettings({});
    etag = null;
    remoteCache = null;
    setStatus({ state: 'off', message: 'Nicht eingerichtet' });
  }

  return { start, syncNow, changed, connect, disconnect, status: () => status };
}
