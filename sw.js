// Offline-Betrieb: speichert alle Dateien der App im Browser (Service Worker).
// Seiten (HTML) kommen online immer frisch aus dem Netz und offline aus dem Speicher,
// alle anderen Dateien sind über ?v=<Version> eindeutig und kommen zuerst aus dem Speicher.
// VERSION und FILES schreibt tools/stamp.py – nicht von Hand ändern.
const VERSION = '378d517bec';
const FILES = ["./","index.html","editor.html","gm.html","spieler.html","css/apollo.css?v=378d517bec","css/editor.css?v=378d517bec","css/table.css?v=378d517bec","js/app.js?v=378d517bec","js/boot.js?v=378d517bec","js/content-editor.js?v=378d517bec","js/content.js?v=378d517bec","js/data.js?v=378d517bec","js/editor.js?v=378d517bec","js/equipment-data.js?v=378d517bec","js/equipment.js?v=378d517bec","js/gm.js?v=378d517bec","js/layer.js?v=378d517bec","js/logo.js?v=378d517bec","js/maps.js?v=378d517bec","js/matcher.js?v=378d517bec","js/odt.js?v=378d517bec","js/plans.js?v=378d517bec","js/player.js?v=378d517bec","js/roomlist.js?v=378d517bec","js/semiotic.js?v=378d517bec","js/sound.js?v=378d517bec","js/starmap-data.js?v=378d517bec","js/starmap.js?v=378d517bec","js/station-layer0.js?v=378d517bec","js/station-level0.js?v=378d517bec","js/stationplan.js?v=378d517bec","js/svg.js?v=378d517bec","js/sync.js?v=378d517bec","js/table.js?v=378d517bec","sounds/sounds.json"];
const CACHE = `apollo-${VERSION}`;
const FONT_CACHE = 'apollo-fonts';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES);
    // Schrift: wenn möglich gleich mitnehmen (sonst beim ersten Laden)
    try { await cacheFont(new Request(FONT_CSS)); } catch { /* ohne Netz egal */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('apollo-') && k !== CACHE && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Schrift-CSS und die darin verlinkten Schriftdateien speichern
async function cacheFont(req) {
  const c = await caches.open(FONT_CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await c.put(req, res.clone());
  if (req.url.startsWith('https://fonts.googleapis.com/') && res.ok) {
    const css = await res.clone().text();
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(urls.map(async (u) => { if (!(await c.match(u))) { try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch { /* egal */ } } }));
  }
  return res;
}

const isPage = (req, url) => req.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
const pageKey = (url) => (url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname);

async function fromNetwork(req, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(req, { signal: ctl.signal }); } finally { clearTimeout(timer); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFont(req).catch(() => new Response('', { status: 504 })));
    return;
  }
  if (url.origin !== self.location.origin) return;   // z. B. Abgleich der Raumliste: nur online

  if (isPage(req, url)) {
    // online: frisch (mit Zeitlimit), danach im Speicher ablegen; offline: gespeicherte Seite
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await fromNetwork(req, 5000);
        if (res.ok) await c.put(pageKey(url), res.clone());
        return res;
      } catch {
        return (await c.match(pageKey(url))) || (await caches.match(pageKey(url), { ignoreSearch: true }))
          || new Response('A.P.O.L.L.O. ist offline noch nicht verfügbar. Bitte einmal online öffnen.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // übrige Dateien: zuerst Speicher, sonst Netz (und merken)
  e.respondWith((async () => {
    const exact = await caches.match(req);
    if (exact && url.search) return exact;      // versionierte Datei: genau diese Version
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      // offline: notfalls eine ältere gespeicherte Fassung derselben Datei
      return exact || (await caches.match(req, { ignoreSearch: true })) || new Response('', { status: 504 });
    }
  })());
});
