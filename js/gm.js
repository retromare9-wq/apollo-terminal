// GM-Karte: Tokens, Pings, Piktogramme, Türen, Kameras, Notizen und Räume verwalten,
// Ausschnitt an die Spielerkarte senden oder live mitlaufen lassen.
// Maus: Linksklick wählt aus bzw. setzt (Fadenkreuz), Linksziehen verschiebt das Objekt,
// rechte Maustaste ziehen verschiebt die Karte, Mausrad zoomt. Pfeiltasten bewegen die Auswahl.
import { loadContent } from './content.js';
import { applyZoom, roomName, roomCode, roomZone } from './stationplan.js';
import { saveLayer, snapDoor, SECURITY, CAM, STATUS, MAX_PICTOS, roomDoors, roomShafts } from './layer.js';
import { SEMIOTIC, semioticSvg, semioticById } from './semiotic.js';
import { equipmentList } from './equipment.js';
import {
  roomSync, roomListEmpty, roomListEntries, updateEntry, addEntry, mapLinkOf, LIST_TEXT_FIELDS, TERMINAL_PICTO, onRoomListChange,
} from './roomlist.js';
import { levelNum } from './plans.js';
import {
  loadTable, saveTable, notifyChange, postView, onTableChange, drawTable, allLevels, startLevel,
  roomLabel, roomEntry, pictoName, KINDS, KIND_COLOR, PING_MS, PICTO_SIZE, uid,
} from './table.js';

loadContent();

const $ = (s) => document.querySelector(s);
const svg = $('#map');
const side = $('#side');
const win = $('#roomwin');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = (s) => esc(s).replace(/\n/g, '<br>');

let t = loadTable();
let levels = allLevels();
let lv = null;
let layer = null;
let info = null;
const st = {
  vb: null, sel: null, drag: null, place: null,
  open: 'tokens', tokFilter: 'all', roomQ: '', roomEdit: false, big: false, doorSec: 'green',
};
const LV_KEY = 'apollo.gm.level';

const SECTIONS = [
  ['tokens', 'TOKENS'], ['pings', 'PINGS'], ['pictos', 'PIKTOGRAMME'], ['doors', 'TÜREN'],
  ['cams', 'KAMERAS'], ['notes', 'NOTIZEN'], ['rooms', 'RÄUME'],
];
const KIND_SECTION = { token: 'tokens', ping: 'pings', picto: 'pictos', door: 'doors', cam: 'cams', note: 'notes', room: 'rooms' };
const KIND_ORDER = ['pc', 'npc', 'alien', 'other'];
const KIND_PLURAL = { pc: 'SPIELERCHARAKTERE', npc: 'NSC', alien: 'XENOS', other: 'SONSTIGE' };
const SIZES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

// ---------- Ansicht ----------

let followTimer = 0;
function setVB(r) {
  st.vb = r;
  svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`);
  applyZoom(svg, r.w / (svg.clientWidth || 1000));
  if (t.follow && lv) {
    const v = { levelId: lv.id, vb: { ...r } };
    postView(v);
    t.player = v;
    clearTimeout(followTimer);
    followTimer = setTimeout(() => { saveTable(t, true); renderPlayerState(); }, 300);
  }
}

function homeView() {
  const b = lv.plan.bounds;
  const w = svg.clientWidth || 1000;
  const h = svg.clientHeight || 600;
  let vw = b[2] - b[0] + 160;
  let vh = b[3] - b[1] + 160;
  if (vh / vw > h / w) vw = vh * (w / h); else vh = vw * (h / w);
  setVB({ x: (b[0] + b[2]) / 2 - vw / 2, y: (b[1] + b[3]) / 2 - vh / 2, w: vw, h: vh });
}

function toMap(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

let pingTimer = 0;
function render() {
  info = drawTable(svg, lv, t, 'gm');
  layer = info.plan.layer;
  const s = st.sel;
  if (s?.kind === 'room') info.plan.nodes[s.id]?.classList.add('sel');
  else if (s) svg.querySelector(`[data-${s.kind}="${s.id}"]`)?.classList.add('tt-sel');
  svg.classList.toggle('placing', !!st.place);
  setVB(st.vb);
  renderPlayerState();
  clearTimeout(pingTimer);
  const next = t.pings.filter((p) => !p.keep).map((p) => p.t + PING_MS - Date.now()).filter((ms) => ms > 0);
  if (next.length) pingTimer = setTimeout(() => { t = loadTable(); render(); if (st.open === 'pings') renderSide(); }, Math.min(...next) + 60);
}

function commit() {
  if (!saveTable(t)) toast('SPEICHERN FEHLGESCHLAGEN');
  render();
  renderSide();
}
function commitLayer(side = true) {
  if (!saveLayer(lv.id, layer)) toast('SPEICHERN FEHLGESCHLAGEN');
  notifyChange();
  render();
  if (side) renderSide();
}

function selectLevel(id) {
  lv = levels.find((l) => l.id === id) || startLevel(levels);
  try { localStorage.setItem(LV_KEY, lv.id); } catch { /* egal */ }
  $('#lvl').value = lv.id;
  if (st.sel && st.sel.kind !== 'token') st.sel = null;
  st.place = null;
  homeView();
  render();
  // alte Einstellung „alle Türen aufgedeckt“ in Einzelfreigaben umwandeln
  const d = t.doors[lv.id];
  if (d?.all) { d.ids = Object.fromEntries(layer.doors.map((x) => [x.id, true])); delete d.all; saveTable(t, true); }
  renderSide();
}

let toastTimer = 0;
function toast(text, sticky = false) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}
const hideToast = () => { $('#toast').hidden = true; };

function renderPlayerState() {
  const p = t.player && levels.find((l) => l.id === t.player.levelId);
  $('#pstate').textContent = `SPIELER SEHEN: ${p ? p.plan.name : 'STARTANSICHT'}${t.follow ? ' · LIVE' : ''}`;
}

// ---------- Objekte ----------

const findTok = (id) => t.tokens.find((k) => k.id === id);
function selObj(s = st.sel) {
  if (!s) return null;
  const list = { token: t.tokens, note: t.notes, ping: t.pings, picto: t.pictos, door: layer?.doors, cam: layer?.cams, room: lv?.plan.rooms }[s.kind];
  return list?.find((o) => o.id === s.id) || null;
}
const isLayerKind = (k) => k === 'door' || k === 'cam';

function select(kind, id) {
  st.sel = kind ? { kind, id } : null;
  if (kind) st.open = KIND_SECTION[kind];
  if (kind === 'room') st.roomEdit = false;
  render();
  renderSide();
}

function startPlace(p, msg) {
  st.place = p;
  svg.classList.add('placing');
  toast(`${msg} – AUF DIE KARTE KLICKEN · ESC = ABBRECHEN`, true);
}
function cancelPlace() {
  st.place = null;
  svg.classList.remove('placing');
  hideToast();
}

function doPlace(pt) {
  const p = st.place;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  if (p.kind === 'door') {
    const s = snapDoor(lv.plan, x, y);
    if (!s) { toast('TÜREN NUR AN EINER RAUMWAND ODER QUER IN EINEM GANG – NOCHMAL KLICKEN · ESC = ABBRECHEN', true); return; }
    cancelPlace();
    const d = { id: uid('d'), ...s, sec: p.sec || 'green' };
    layer.doors.push(d);
    st.sel = { kind: 'door', id: d.id };
    commitLayer();
    return;
  }
  cancelPlace();
  if (p.kind === 'cam') {
    const c = { id: uid('c'), x, y, dir: 0, range: CAM.def };
    layer.cams.push(c);
    st.sel = { kind: 'cam', id: c.id };
    commitLayer();
    return;
  }
  if (p.kind === 'token') {
    const k = findTok(p.id);
    if (!k) return;
    Object.assign(k, { levelId: lv.id, x, y });
    st.sel = { kind: 'token', id: k.id };
  } else if (p.kind === 'note') {
    const n = { id: uid('n'), levelId: lv.id, x, y, text: 'NOTIZ', color: '#e3cb5c', visible: false };
    t.notes.push(n);
    st.sel = { kind: 'note', id: n.id };
  } else if (p.kind === 'ping') {
    const q = { id: uid('p'), levelId: lv.id, x, y, t: Date.now(), keep: !!p.keep };
    t.pings.push(q);
  } else if (p.kind === 'picto') {
    const q = { id: uid('g'), levelId: lv.id, x, y, sym: p.sym, size: PICTO_SIZE, visible: false };
    t.pictos.push(q);
    st.sel = { kind: 'picto', id: q.id };
  }
  commit();
  if (p.kind === 'note') side.querySelector('[data-f="text"]')?.select();
}

function deleteSel() {
  const s = st.sel;
  const o = selObj();
  if (!o) return;
  if (s.kind === 'token') { o.levelId = null; st.sel = null; commit(); toast('TOKEN IM VORRAT'); return; }
  if (s.kind === 'room') return;
  if (isLayerKind(s.kind)) {
    if (!confirm(s.kind === 'door' ? 'Diese Tür löschen? (Auch im Editor und Terminal)' : 'Diese Kamera löschen? (Auch im Editor und Terminal)')) return;
    layer[s.kind === 'door' ? 'doors' : 'cams'] = layer[s.kind === 'door' ? 'doors' : 'cams'].filter((x) => x !== o);
    st.sel = null;
    commitLayer();
    return;
  }
  const key = { note: 'notes', ping: 'pings', picto: 'pictos' }[s.kind];
  t[key] = t[key].filter((x) => x !== o);
  st.sel = null;
  commit();
}

// ---------- Seitenleiste ----------

const onLevel = (list) => list.filter((o) => o.levelId === lv.id);

function count(k) {
  switch (k) {
    case 'tokens': return `${onLevel(t.tokens).length}/${t.tokens.length}`;
    case 'pings': return onLevel(t.pings).length;
    case 'pictos': return onLevel(t.pictos).length;
    case 'doors': return layer.doors.length;
    case 'cams': return layer.cams.length;
    case 'notes': return onLevel(t.notes).length;
    case 'rooms': return lv.plan.rooms.length;
    default: return '';
  }
}

const chk = (f, label, on) => `<label class="gm-check"><input type="checkbox" data-f="${f}" ${on ? 'checked' : ''}> ${label}</label>`;
const swatch = (k) => (k.img ? `<img class="sh sh-${k.kind}" src="${esc(k.img)}" alt="" style="border-color:${esc(k.color)}">` : `<i class="sh sh-${k.kind}" style="background:${esc(k.color || KIND_COLOR[k.kind])}"></i>`);

function tokensHtml() {
  const k = st.sel?.kind === 'token' ? selObj() : null;
  let form = '';
  if (k) {
    const here = k.levelId === lv.id;
    form = `<div class="gm-form">
      <label class="gm-f">NAME <input data-f="name" value="${esc(k.name)}" maxlength="30"></label>
      <div class="gm-row">
        <label class="gm-f">KÜRZEL <input data-f="short" value="${esc(k.short)}" maxlength="2" placeholder="auto"></label>
        <label class="gm-f">FARBE <input type="color" data-f="color" value="${esc(k.color || KIND_COLOR[k.kind])}"></label>
        <label class="gm-f">GRÖSSE <select data-f="size">${SIZES.map((v) => `<option value="${v}" ${Number(k.size || 1) === v ? 'selected' : ''}>${v}×</option>`).join('')}</select></label>
      </div>
      <label class="gm-f">ART <select data-f="kind">${Object.entries(KINDS).map(([v, l]) => `<option value="${v}" ${k.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${chk('hidden', 'FÜR SPIELER VERSTECKT', k.hidden)}
      <div class="gm-img">${k.img ? swatch(k) : '<span class="dim">KEIN BILD</span>'}
        <button data-act="timg">BILD …</button>${k.img ? '<button data-act="tnoimg" class="danger">✕</button>' : ''}</div>
      <div class="gm-btns">
        <button data-act="tplace" class="hot">⌖ ${here ? 'NEU PLATZIEREN' : 'AUF KARTE SETZEN'}</button>
        ${here ? '<button data-act="tstash">IN DEN VORRAT</button>' : ''}
        ${k.levelId && !here ? '<button data-act="tgoto">ZUR EBENE</button>' : ''}
        <button data-act="tdel" class="danger">LÖSCHEN</button>
      </div></div>`;
  }
  const tabs = [['all', 'ALLE'], ['pc', 'SC'], ['npc', 'NSC'], ['alien', 'XENOS'], ['other', 'SONST.']]
    .map(([v, l]) => `<button data-act="tfilter" data-v="${v}" class="${st.tokFilter === v ? 'on' : ''}">${l}</button>`).join('');
  const kinds = st.tokFilter === 'all' ? KIND_ORDER : [st.tokFilter];
  const list = kinds.map((kind) => {
    const ks = t.tokens.filter((x) => (x.kind || 'npc') === kind).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!ks.length) return st.tokFilter === 'all' ? '' : '<p class="dim">Keine Tokens dieser Art.</p>';
    return `${st.tokFilter === 'all' ? `<div class="gm-sub">${KIND_PLURAL[kind]}</div>` : ''}${ks.map((x) => {
      const where = x.levelId ? (levels.find((l) => l.id === x.levelId)?.plan.name || '?') : 'VORRAT';
      return `<button class="gm-trow ${k === x ? 'on' : ''}" data-act="sel" data-kind="token" data-id="${x.id}">${swatch(x)}<span class="n">${esc(x.name)}</span><span class="dim">${x.hidden ? 'VERSTECKT · ' : ''}${esc(where)}</span></button>`;
    }).join('')}`;
  }).join('');
  return `${form}
    <div class="gm-btns"><button data-act="tnew">+ NEUER TOKEN</button></div>
    <div class="gm-tabs">${tabs}</div>
    <div class="gm-tlist">${list || '<p class="dim">Noch keine Tokens. Lege sie vorab an – sie bleiben gespeichert.</p>'}</div>`;
}

function pingsHtml() {
  const ps = onLevel(t.pings);
  const sel = st.sel?.kind === 'ping' ? st.sel.id : null;
  return `<div class="gm-btns"><button data-act="pplace" class="hot">⌖ PING SETZEN</button><button data-act="pplacek">⌖ PING (BLEIBT)</button></div>
    <p class="gm-note">Rot pulsierend, sichtbar für die Spieler. Normale Pings verschwinden nach 20 Sekunden.</p>
    <div class="gm-tlist">${ps.map((p, i) => `<div class="gm-lrow ${sel === p.id ? 'on' : ''}"><button data-act="sel" data-kind="ping" data-id="${p.id}">PING ${i + 1} · ${p.keep ? 'BLEIBT' : `NOCH ${Math.max(0, Math.round((p.t + PING_MS - Date.now()) / 1000))} S`}</button><button data-act="pdel" data-id="${p.id}" class="danger">✕</button></div>`).join('') || '<p class="dim">Keine Pings auf dieser Ebene.</p>'}</div>
    ${ps.length ? '<div class="gm-btns"><button data-act="pclear" class="danger">ALLE PINGS ENTFERNEN</button></div>' : ''}`;
}

function pictosHtml() {
  const p = st.sel?.kind === 'picto' ? selObj() : null;
  const form = p ? `<div class="gm-form">
      <div class="gm-pichead">${semioticSvg(p.sym, 46)}<div><b>${esc(pictoName(t, p.sym))}</b><br><span class="dim">${esc(semioticById(p.sym)?.name)}</span></div></div>
      <label class="gm-f">NAME (BEIM DARÜBERFAHREN) <input data-f="pname" value="${esc(t.pictoNames[p.sym] || '')}" placeholder="${esc(semioticById(p.sym)?.de)}"></label>
      <label class="gm-f">GRÖSSE <select data-f="size">${[16, 24, 32, 48, 64].map((v) => `<option value="${v}" ${Number(p.size || PICTO_SIZE) === v ? 'selected' : ''}>${v / 20} M</option>`).join('')}</select></label>
      ${chk('visible', 'AUF DER SPIELERKARTE ZEIGEN', p.visible)}
      <div class="gm-btns"><button data-act="delsel" class="danger">LÖSCHEN</button></div></div>` : '';
  const placed = onLevel(t.pictos);
  return `${form}
    <p class="gm-note">Klick: Piktogramm setzen (Fadenkreuz) · Rechtsklick: Namen geben</p>
    <div class="gm-palette">${SEMIOTIC.map((sm) => `<button class="gm-pal ${st.place?.sym === sm.id ? 'on' : ''}" data-act="gplace" data-v="${sm.id}" data-pal="${sm.id}" title="${esc(pictoName(t, sm.id))}">${semioticSvg(sm.id, 34)}</button>`).join('')}</div>
    ${placed.length ? `<div class="gm-sub">AUF DIESER EBENE</div><div class="gm-tlist">${placed.map((q) => `<button class="gm-trow ${p === q ? 'on' : ''}" data-act="sel" data-kind="picto" data-id="${q.id}"><span class="pic">${semioticSvg(q.sym, 20)}</span><span class="n">${esc(pictoName(t, q.sym))}</span><span class="dim">${q.visible ? 'SPIELER' : 'NUR GM'}</span></button>`).join('')}</div>` : ''}`;
}

const doorShown = (id) => !!t.doors[lv.id]?.ids?.[id];
const secBtns = (act, cur) => Object.entries(SECURITY).map(([k, s]) => `<button data-act="${act}" data-v="${k}" class="sec-b sec-${k} ${cur === k ? 'on' : ''}">${s.label}</button>`).join('');

function doorsHtml() {
  const d = st.sel?.kind === 'door' ? selObj() : null;
  const shown = layer.doors.filter((x) => doorShown(x.id)).length;
  const form = d ? `<div class="gm-form">
      <div class="gm-sub">AUSGEWÄHLTE TÜR</div>
      <div class="gm-btns">${secBtns('dsec', d.sec || 'green')}</div>
      ${chk('pv', 'FARBE AUF DER SPIELERKARTE ZEIGEN', doorShown(d.id))}
      <p class="gm-note">Sonst sehen die Spieler die Tür grau. Pfeiltasten verschieben die Tür entlang der Wand.</p>
      <div class="gm-btns"><button data-act="delsel" class="danger">TÜR LÖSCHEN</button></div></div>` : '<p class="gm-note">Tür auf der Karte anklicken, um sie zu bearbeiten.</p>';
  return `${form}
    <div class="gm-sub">NEUE TÜR</div>
    <div class="gm-btns">${secBtns('dnewsec', st.doorSec)}</div>
    <div class="gm-btns"><button data-act="dplace" class="hot">⌖ TÜR SETZEN</button></div>
    <div class="gm-sub">SPIELERKARTE</div>
    <p class="gm-note">${shown} von ${layer.doors.length} Türen zeigen den Spielern ihre Farbe.</p>
    <div class="gm-btns"><button data-act="dall">ALLE FARBEN ZEIGEN</button><button data-act="dnone">ALLE GRAU</button></div>`;
}

const camOn = (id) => !!t.cams[lv.id]?.[id];
function camsHtml() {
  const c = st.sel?.kind === 'cam' ? selObj() : null;
  const form = c ? `<div class="gm-form">
      ${chk('pv', 'AUF DER SPIELERKARTE ZEIGEN', camOn(c.id))}
      <label class="gm-f">RICHTUNG <input type="range" data-f="dir" min="0" max="355" step="5" value="${Number(c.dir) || 0}"></label>
      <label class="gm-f">REICHWEITE <input type="range" data-f="range" min="${CAM.min}" max="${CAM.max}" step="10" value="${Number(c.range) || CAM.def}"></label>
      <div class="gm-btns"><button data-act="delsel" class="danger">KAMERA LÖSCHEN</button></div></div>` : '';
  const roomOf = (cam) => lv.plan.rooms.find((r) => r.rects.some((rc) => cam.x >= rc[0] && cam.x <= rc[2] && cam.y >= rc[1] && cam.y <= rc[3]));
  return `${form}
    <div class="gm-btns"><button data-act="cplace" class="hot">⌖ KAMERA SETZEN</button></div>
    <p class="gm-note">Kameras sind für die Spieler verborgen, bis du sie einzeln freigibst.</p>
    <div class="gm-tlist">${layer.cams.map((x, i) => {
      const r = roomOf(x);
      return `<button class="gm-trow ${c === x ? 'on' : ''}" data-act="sel" data-kind="cam" data-id="${x.id}"><i class="sh cam"></i><span class="n">KAMERA ${i + 1}${r ? ` · ${esc(roomLabel(lv, r, layer).code)}` : ''}</span><span class="dim">${camOn(x.id) ? 'SPIELER' : 'NUR GM'}</span></button>`;
    }).join('') || '<p class="dim">Keine Kameras auf dieser Ebene.</p>'}</div>`;
}

function notesHtml() {
  const n = st.sel?.kind === 'note' ? selObj() : null;
  const form = n ? `<div class="gm-form">
      <label class="gm-f">TEXT <textarea data-f="text" rows="4" maxlength="400">${esc(n.text)}</textarea></label>
      <div class="gm-row"><label class="gm-f">FARBE <input type="color" data-f="color" value="${esc(n.color || '#e3cb5c')}"></label></div>
      ${chk('visible', 'AUF DER SPIELERKARTE ZEIGEN', n.visible)}
      <div class="gm-btns"><button data-act="delsel" class="danger">LÖSCHEN</button></div></div>` : '';
  const ns = onLevel(t.notes);
  return `${form}
    <div class="gm-btns"><button data-act="nplace" class="hot">⌖ NOTIZ SETZEN</button></div>
    <div class="gm-tlist">${ns.map((x) => `<button class="gm-trow ${n === x ? 'on' : ''}" data-act="sel" data-kind="note" data-id="${x.id}"><i class="sh" style="background:${esc(x.color)}"></i><span class="n">${esc(String(x.text).split('\n')[0])}</span><span class="dim">${x.visible ? 'SPIELER' : 'NUR GM'}</span></button>`).join('') || '<p class="dim">Keine Notizen auf dieser Ebene.</p>'}</div>`;
}

// ---------- Räume ----------

const isCluttered = (e) => (e ? e.cluttered !== false && e.cluttered !== '' : true);

function roomRows() {
  const q = st.roomQ.trim().toLowerCase();
  return lv.plan.rooms.map((r) => ({ r, ...roomLabel(lv, r, layer) }))
    .filter((x) => !q || `${x.code} ${x.name} ${x.entry?.area || ''} ${x.entry?.subarea || ''}`.toLowerCase().includes(q))
    .sort((a, b) => a.code.localeCompare(b.code, 'de', { numeric: true }))
    .map((x) => `<button class="gm-rrow" data-act="sel" data-kind="room" data-id="${esc(x.r.id)}"><b>${esc(x.code)}</b><span>${esc(x.name)}</span></button>`).join('')
    || '<p class="dim">Kein Raum gefunden.</p>';
}

function roomsHtml() {
  const room = st.sel?.kind === 'room' ? selObj() : null;
  if (room) {
    if (st.big) return `<div class="gm-btns"><button data-act="rback">← ALLE RÄUME</button></div><p class="gm-note">Raum ist im großen Fenster geöffnet.</p><div class="gm-btns"><button data-act="rbig">IN DER LEISTE ZEIGEN</button></div>`;
    return `<div class="gm-btns"><button data-act="rback">← ALLE RÄUME</button></div>${roomPanel(room, false)}`;
  }
  const open = roomListEntries().filter((e) => !isCluttered(e)).length;
  return `<input class="gm-search" id="room-q" placeholder="SUCHEN: CODE ODER NAME" value="${esc(st.roomQ)}">
    <div class="gm-rlist" id="room-list">${roomRows()}</div>
    ${open ? `<p class="gm-note">${open} Räume der Raumliste stehen auf OPEN.</p><div class="gm-btns"><button data-act="rclutter">ALLE RÄUME AUF CLUTTERED</button></div>` : ''}`;
}

const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
function mapFacts(room) {
  const d = layer.rooms[room.id] || {};
  return { doors: roomDoors(layer, room).length, shafts: roomShafts(layer, room).length, terminal: (d.picto || []).some((p) => p.id === TERMINAL_PICTO) };
}
// Eintrag der Raumliste sicherstellen (wie im Editor beim Bearbeiten)
function ensureEntry(room) {
  if (roomListEmpty()) return null;
  const link = mapLinkOf(lv.id, room);
  let e = roomEntry(lv, room, layer);
  if (!e) {
    const no = levelNum(lv.plan.name);
    e = addEntry({
      area: titleCase(roomZone(lv.plan, room, layer)), name: titleCase(roomName(lv.plan, room, layer)), roomId: roomCode(room, layer),
      level: no == null ? '' : String(no), cluttered: true, ...mapFacts(room), mapLink: link,
    });
  }
  if (e.mapLink !== link) e = updateEntry(e.id, { mapLink: link });
  return e;
}

function patchRoom(id, patch) {
  const d = { ...(layer.rooms[id] || {}), ...patch };
  for (const k of Object.keys(d)) if (d[k] === '' || d[k] == null || (Array.isArray(d[k]) && !d[k].length)) delete d[k];
  if (Object.keys(d).length) layer.rooms[id] = d; else delete layer.rooms[id];
  saveLayer(lv.id, layer);
  notifyChange();
}

function roomPanel(room, big) {
  const { code, name, entry: e } = roomLabel(lv, room, layer);
  const d = layer.rooms[room.id] || {};
  const pics = d.picto || [];
  const head = `<div class="gm-rhead">
      <div><div class="dim">${esc([e?.area, e?.subarea].filter(Boolean).join(' › ') || roomZone(lv.plan, room, layer))}</div>
        <div class="gm-rname">${esc(code)} · ${esc(e?.name || name)}</div></div>
      <div class="gm-rbtns">
        <button data-act="redit" class="${st.roomEdit ? 'on' : ''}" title="${st.roomEdit ? 'Bearbeiten beenden' : 'Bearbeiten'}">✎</button>
        <button data-act="rbig" title="${big ? 'Verkleinern' : 'Groß anzeigen'}">${big ? '✕' : '⤢'}</button>
      </div></div>`;
  return `<div class="gm-room ${big ? 'big' : ''}">${head}${st.roomEdit ? roomEditHtml(room, e, d, pics) : roomViewHtml(room, e, d, pics)}</div>`;
}

function roomViewHtml(room, e, d, pics) {
  const facts = [
    isCluttered(e) ? 'CLUTTERED' : 'OPEN',
    e?.core ? '★ KERNORT' : '',
    e?.terminal ? 'TERMINAL' : '',
    Number(e?.shafts) ? `${e.shafts} ${Number(e.shafts) === 1 ? 'SCHACHTZUGANG' : 'SCHACHTZUGÄNGE'}` : '',
    Number(e?.doors) ? `${e.doors} TÜR${Number(e.doors) === 1 ? '' : 'EN'}` : '',
    d.status ? STATUS[d.status] : '',
  ].filter(Boolean).map((f) => `<span>${f}</span>`).join('');
  const texts = e ? LIST_TEXT_FIELDS.filter(([k]) => String(e[k] || '').trim())
    .map(([k, label]) => `<div class="gm-rf ${k === 'aesthetics' ? 'aes' : ''}"><span class="dim">${label}</span><p>${br(e[k])}</p></div>`).join('') : '';
  const note = roomListEmpty() ? '<p class="gm-note">Die Raumliste ist in diesem Browser nicht geladen (im Editor einrichten).</p>'
    : !e ? '<p class="gm-note">Noch kein Eintrag in der Raumliste – mit ✎ anlegen.</p>' : '';
  return `<div class="gm-rfacts">${facts}</div>
    ${d.info ? `<div class="gm-rf"><span class="dim">NOTIZ IM TERMINAL</span><p>${br(d.info)}</p></div>` : ''}
    ${pics.length ? `<div class="gm-rpics">${pics.map((p) => `<span title="${esc(pictoName(t, p.id))}">${semioticSvg(p.id, 34)}</span>`).join('')}</div>` : ''}
    <div class="gm-rtexts">${texts || (e ? '<p class="dim">Noch keine Beschreibung.</p>' : '')}</div>${note}`;
}

function roomEditHtml(room, e, d, pics) {
  const all = roomListEntries();
  const opts = (k) => [...new Set(all.map((x) => x[k]).filter(Boolean))].sort().map((v) => `<option value="${esc(v)}">`).join('');
  const inp = (k, label, attrs = '') => `<label class="gm-f">${label} <input data-rl="${k}" value="${esc(e[k])}" ${attrs}></label>`;
  const cb = (k, label, on) => `<label class="gm-check"><input type="checkbox" data-rlb="${k}" ${on ? 'checked' : ''}> ${label}</label>`;
  const num = (k, label) => `<label class="gm-f">${label} <input inputmode="numeric" data-rln="${k}" value="${Number(e[k]) || 0}"></label>`;
  const list = e ? `<div class="gm-sub">RAUMLISTE</div>
      <datalist id="gm-areas">${opts('area')}</datalist><datalist id="gm-subareas">${opts('subarea')}</datalist>
      <div class="gm-row2">${inp('area', 'OBERBEREICH', 'list="gm-areas"')}${inp('subarea', 'UNTERBEREICH', 'list="gm-subareas"')}</div>
      ${inp('name', 'NAME DES RAUMS')}
      <div class="gm-row2">${inp('roomId', 'RAUM-ID')}${inp('level', 'EBENE')}</div>
      ${cb('cluttered', 'CLUTTERED (SONST OPEN)', isCluttered(e))}
      ${cb('core', '★ KERNORT', e.core)}
      ${cb('terminal', 'TERMINAL', e.terminal)}
      <div class="gm-row2">${num('shafts', '# SCHACHTZUGÄNGE')}${num('doors', '# TÜREN')}</div>
      <div class="gm-btns"><button data-act="rfacts">WERTE AUS DER KARTE ÜBERNEHMEN</button></div>`
    : '<div class="gm-sub">RAUMLISTE</div><p class="gm-note">Die Raumliste ist in diesem Browser nicht geladen. Sie wird im Editor eingerichtet.</p>';
  const mapCol = `<div class="gm-sub">KARTE & TERMINAL</div>
      <label class="gm-f">ID AUF DER KARTE <input data-rk="code" maxlength="20" value="${esc(d.code)}" placeholder="${esc(room.id)}"></label>
      <label class="gm-f">NAME IM TERMINAL <input data-rk="name" maxlength="40" value="${esc(d.name)}" placeholder="${esc(roomName(lv.plan, room, { rooms: {} }))}"></label>
      <label class="gm-f">BEREICH IM TERMINAL <input data-rk="zoneName" maxlength="40" value="${esc(d.zoneName)}" placeholder="${esc(lv.plan.zones[room.zone] || room.zone)}"></label>
      <label class="gm-f">STATUS <select data-rk="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(d.status || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="gm-f">NOTIZ (ERSCHEINT IM TERMINAL) <textarea data-rk="info" maxlength="300" rows="3">${esc(d.info)}</textarea></label>
      <div class="gm-sub">PIKTOGRAMME (${pics.length}/${MAX_PICTOS})</div>
      <div class="gm-tlist">${pics.map((p, i) => `<div class="gm-dpic">${semioticSvg(p.id, 38)}<div><b>${esc(pictoName(t, p.id))}</b>
        <label class="gm-check"><input type="checkbox" data-pmap="${i}" ${p.map ? 'checked' : ''}> AUF DER KARTE</label></div>
        <button class="danger" data-act="rpdel" data-v="${i}">✕</button></div>`).join('') || '<p class="dim">Noch keine. Unten anklicken zum Hinzufügen.</p>'}</div>
      <div class="gm-palette">${SEMIOTIC.map((sm) => `<button class="gm-pal" data-act="rpadd" data-v="${sm.id}" data-pal="${sm.id}" title="${esc(pictoName(t, sm.id))}" ${pics.length >= MAX_PICTOS || pics.some((p) => p.id === sm.id) ? 'disabled' : ''}>${semioticSvg(sm.id, 30)}</button>`).join('')}</div>`;
  const texts = e ? `<div class="gm-sub">BESCHREIBUNG (RAUMLISTE)</div>
      ${LIST_TEXT_FIELDS.map(([k, label]) => `<label class="gm-f">${label}<textarea data-rl="${k}" rows="${k === 'aesthetics' || k === 'investigate' ? 5 : 3}">${esc(e[k])}</textarea></label>`).join('')}
      <div class="gm-row2 eq"><input id="eq-search" list="eq-list" placeholder="GEGENSTAND AUS DER AUSRÜSTUNGSLISTE …"><input id="eq-qty" placeholder="ANZ."></div>
      <div class="gm-btns"><button data-act="eqadd">ZU „GEGENSTÄNDE“ HINZUFÜGEN</button></div>
      <datalist id="eq-list">${equipmentList().map((it) => `<option value="${esc(it.name)}">${esc(it.cat)}</option>`).join('')}</datalist>
      <p class="gm-note">Raumliste und Beschreibung werden mit der Handy-App abgeglichen.</p>` : '';
  return `<div class="gm-rcols"><div class="gm-rcol">${list}${mapCol}</div><div class="gm-rcol">${texts}</div></div>`;
}

function curRoom() { return st.sel?.kind === 'room' ? selObj() : null; }

function renderRoomWin() {
  const room = curRoom();
  if (!st.big || !room) { win.hidden = true; win.innerHTML = ''; return; }
  win.innerHTML = `<div class="gm-mwin">${roomPanel(room, true)}</div>`;
  win.hidden = false;
}

// ---------- Leiste zeichnen ----------

const SECT = { tokens: tokensHtml, pings: pingsHtml, pictos: pictosHtml, doors: doorsHtml, cams: camsHtml, notes: notesHtml, rooms: roomsHtml };

function renderSide() {
  const top = side.scrollTop;
  side.innerHTML = SECTIONS.map(([k, label]) => {
    const open = st.open === k;
    return `<section class="gm-sec ${open ? 'open' : ''}">
      <button class="gm-sech" data-sec="${k}"><b>${open ? '▾' : '▸'}</b> ${label}<span>${count(k)}</span></button>
      ${open ? `<div class="gm-secb">${SECT[k]()}</div>` : ''}</section>`;
  }).join('');
  side.scrollTop = top;
  renderRoomWin();
}

// ---------- Aktionen ----------

function action(b) {
  const a = b.dataset.act;
  const v = b.dataset.v;
  const o = selObj();
  switch (a) {
    case 'sel': select(b.dataset.kind, b.dataset.id); centerIfOff(); return;
    case 'delsel': deleteSel(); return;
    // Tokens
    case 'tnew': {
      const kind = st.tokFilter !== 'all' ? st.tokFilter : 'npc';
      const k = { id: uid('t'), name: 'NEUER TOKEN', kind, color: KIND_COLOR[kind], size: 1, hidden: false, img: '', levelId: null, x: 0, y: 0 };
      t.tokens.push(k);
      st.sel = { kind: 'token', id: k.id };
      commit();
      side.querySelector('[data-f="name"]')?.select();
      return;
    }
    case 'tfilter': st.tokFilter = v; renderSide(); return;
    case 'tplace': startPlace({ kind: 'token', id: o.id }, `${o.name} SETZEN`); return;
    case 'tstash': o.levelId = null; commit(); return;
    case 'tgoto': selectLevel(o.levelId); st.sel = { kind: 'token', id: o.id }; centerOn(o); render(); renderSide(); return;
    case 'tdel': if (confirm(`Token „${o.name}“ endgültig löschen?`)) { t.tokens = t.tokens.filter((x) => x !== o); st.sel = null; commit(); } return;
    case 'tnoimg': o.img = ''; commit(); return;
    case 'timg': pickImage(o); return;
    // Pings
    case 'pplace': startPlace({ kind: 'ping' }, 'PING'); return;
    case 'pplacek': startPlace({ kind: 'ping', keep: true }, 'BLEIBENDER PING'); return;
    case 'pdel': t.pings = t.pings.filter((p) => p.id !== b.dataset.id); if (st.sel?.id === b.dataset.id) st.sel = null; commit(); return;
    case 'pclear': t.pings = t.pings.filter((p) => p.levelId !== lv.id); commit(); return;
    // Piktogramme
    case 'gplace': startPlace({ kind: 'picto', sym: Number(v) }, `PIKTOGRAMM „${pictoName(t, Number(v))}“`); renderSide(); return;
    // Türen
    case 'dsec': o.sec = v; commitLayer(); return;
    case 'dnewsec': st.doorSec = v; renderSide(); return;
    case 'dplace': startPlace({ kind: 'door', sec: st.doorSec }, `TÜR (${SECURITY[st.doorSec].label})`); return;
    case 'dall': t.doors[lv.id] = { ids: Object.fromEntries(layer.doors.map((x) => [x.id, true])) }; commit(); return;
    case 'dnone': t.doors[lv.id] = { ids: {} }; commit(); return;
    // Kameras
    case 'cplace': startPlace({ kind: 'cam' }, 'KAMERA'); return;
    // Notizen
    case 'nplace': startPlace({ kind: 'note' }, 'NOTIZ'); return;
    // Räume
    case 'rback': st.sel = null; st.big = false; render(); renderSide(); return;
    case 'rbig': st.big = !st.big; renderSide(); return;
    case 'redit': st.roomEdit = !st.roomEdit; if (st.roomEdit) ensureEntry(o); renderSide(); return;
    case 'rclutter': {
      const open = roomListEntries().filter((e) => !isCluttered(e));
      if (!confirm(`${open.length} Räume auf CLUTTERED setzen?`)) return;
      open.forEach((e) => updateEntry(e.id, { cluttered: true }));
      renderSide();
      toast('ALLE RÄUME STEHEN AUF CLUTTERED');
      return;
    }
    case 'rfacts': { const e = ensureEntry(o); if (e) updateEntry(e.id, mapFacts(o)); renderSide(); toast('WERTE AUS DER KARTE ÜBERNOMMEN'); return; }
    case 'rpdel': { const pics = (layer.rooms[o.id]?.picto || []).filter((_, i) => i !== Number(v)); patchRoom(o.id, { picto: pics }); render(); renderSide(); return; }
    case 'rpadd': {
      const pics = [...(layer.rooms[o.id]?.picto || [])];
      if (pics.length >= MAX_PICTOS || pics.some((p) => p.id === Number(v))) return;
      pics.push({ id: Number(v), map: !pics.some((p) => p.map) });
      patchRoom(o.id, { picto: pics });
      render();
      renderSide();
      return;
    }
    case 'eqadd': {
      const root = b.closest('.gm-room');
      const s = root.querySelector('#eq-search');
      const name = s.value.trim();
      if (!name) return;
      const qty = root.querySelector('#eq-qty').value.trim();
      const area = root.querySelector('[data-rl="items"]');
      area.value = `${area.value.trim() ? `${area.value.trim()}\n` : ''}${qty ? `${qty}× ` : ''}${name}`;
      const e = ensureEntry(o);
      if (e) updateEntry(e.id, { items: area.value });
      s.value = '';
      root.querySelector('#eq-qty').value = '';
      s.focus();
      return;
    }
    default:
  }
}

function onField(inp, changedEv) {
  // Textfelder: beim Verlassen nicht die Leiste neu aufbauen (sonst geht der nächste Klick verloren)
  const textual = inp.tagName === 'TEXTAREA' || (inp.tagName === 'INPUT' && !['checkbox', 'color', 'range'].includes(inp.type));
  const changed = changedEv && !textual;
  if (changedEv && textual) {
    if (inp.dataset.rl === 'roomId' || inp.dataset.rk === 'code') render();
    return;
  }
  // Raumfelder
  const room = curRoom();
  if (room && (inp.dataset.rl || inp.dataset.rlb || inp.dataset.rln)) {
    const e = ensureEntry(room);
    if (!e) return;
    if (inp.dataset.rl) updateEntry(e.id, { [inp.dataset.rl]: inp.value });
    else if (inp.dataset.rln) updateEntry(e.id, { [inp.dataset.rln]: Math.max(0, parseInt(inp.value, 10) || 0) });
    else if (changed) {
      updateEntry(e.id, { [inp.dataset.rlb]: inp.checked });
      if (inp.dataset.rlb === 'cluttered') patchRoom(room.id, { cluttered: inp.checked || '' });
    }
    return;
  }
  if (room && inp.dataset.rk) {
    patchRoom(room.id, { [inp.dataset.rk]: inp.value });
    if (changed) { render(); renderSide(); }
    return;
  }
  if (room && inp.dataset.pmap != null) {
    if (!changed) return;
    const pics = (layer.rooms[room.id]?.picto || []).map((x, i) => (i === Number(inp.dataset.pmap) ? { ...x, map: inp.checked } : x));
    patchRoom(room.id, { picto: pics });
    render();
    return;
  }
  // Objektfelder
  const f = inp.dataset.f;
  const o = selObj();
  if (!f || !o) return;
  const kind = st.sel.kind;
  let v = inp.type === 'checkbox' ? inp.checked : inp.value;
  if (kind === 'door' && f === 'pv') {
    const d = (t.doors[lv.id] = t.doors[lv.id] || { ids: {} });
    d.ids = d.ids || {};
    if (v) d.ids[o.id] = true; else delete d.ids[o.id];
    commit();
    return;
  }
  if (kind === 'cam' && f === 'pv') {
    const c = (t.cams[lv.id] = t.cams[lv.id] || {});
    if (v) c[o.id] = true; else delete c[o.id];
    commit();
    return;
  }
  if (kind === 'cam') { o[f] = Number(v); saveLayer(lv.id, layer); notifyChange(); render(); return; }
  if (kind === 'picto' && f === 'pname') {
    if (String(v).trim()) t.pictoNames[o.sym] = String(v).trim(); else delete t.pictoNames[o.sym];
    saveTable(t);
    render();
    if (changed) renderSide();
    return;
  }
  if (f === 'size') v = Number(v);
  if (kind === 'token' && (f === 'name' || f === 'short')) v = String(v).toUpperCase();
  if (kind === 'token' && f === 'kind' && (!o.color || o.color === KIND_COLOR[o.kind])) o.color = KIND_COLOR[v];
  o[f] = v;
  saveTable(t);
  render();
  if (changed) renderSide();
  else if (kind === 'token' && f === 'name') side.querySelectorAll('.gm-trow.on .n').forEach((s) => { s.textContent = o.name; });
}

function bindPanel(root) {
  root.addEventListener('click', (e) => {
    const sec = e.target.closest('[data-sec]');
    if (sec) { st.open = st.open === sec.dataset.sec ? null : sec.dataset.sec; renderSide(); return; }
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) action(b);
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'room-q') { st.roomQ = e.target.value; side.querySelector('#room-list').innerHTML = roomRows(); return; }
    if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onField(e.target, false);
  });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'room-q' || e.target.id === 'eq-search' || e.target.id === 'eq-qty') return;
    onField(e.target, true);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'eq-search' || e.target.id === 'eq-qty')) {
      const b = e.target.closest('.gm-room').querySelector('[data-act="eqadd"]');
      action(b);
    }
  });
  // Rechtsklick auf ein Piktogramm der Auswahl: Namen geben
  root.addEventListener('contextmenu', (e) => {
    const p = e.target.closest('[data-pal]');
    if (!p) return;
    e.preventDefault();
    const sym = Number(p.dataset.pal);
    const name = prompt(`Name für „${semioticById(sym)?.name}“ (erscheint beim Darüberfahren). Leer = Standard.`, t.pictoNames[sym] || pictoName(t, sym));
    if (name == null) return;
    if (name.trim()) t.pictoNames[sym] = name.trim(); else delete t.pictoNames[sym];
    commit();
  });
}

function centerOn(o) {
  setVB({ ...st.vb, x: o.x - st.vb.w / 2, y: o.y - st.vb.h / 2 });
}
// Ausgewähltes Objekt ins Bild holen, falls es außerhalb liegt
function centerIfOff() {
  const o = selObj();
  if (!o) return;
  let p = o;
  if (st.sel.kind === 'room') { const r = o.rects[0]; p = { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2 }; }
  if (st.sel.kind === 'token' && o.levelId !== lv.id) return;
  const v = st.vb;
  if (p.x < v.x || p.x > v.x + v.w || p.y < v.y || p.y > v.y + v.h) centerOn(p);
}

// Bild quadratisch (Mitte, oben betont) auf 160 px zuschneiden
function pickImage(o) {
  const f = document.createElement('input');
  f.type = 'file';
  f.accept = 'image/*';
  f.onchange = () => {
    const file = f.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 160;
      cv.getContext('2d').drawImage(img, (img.width - s) / 2, Math.max(0, (img.height - s) * 0.25), s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(url);
      o.img = cv.toDataURL('image/jpeg', 0.85);
      commit();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('BILD KONNTE NICHT GELESEN WERDEN'); };
    img.src = url;
  };
  f.click();
}

// ---------- Maus und Tastatur ----------

const HIT = ['token', 'note', 'ping', 'picto', 'cam', 'door'];

function onDown(e) {
  if (e.button === 2 || e.button === 1) {
    e.preventDefault();
    st.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: { ...st.vb } };
    svg.classList.add('panning');
    svg.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  const pt = toMap(e);
  if (st.place) { doPlace(pt); return; }
  const hit = e.target.closest?.(HIT.map((k) => `[data-${k}]`).join(','));
  if (hit) {
    const kind = HIT.find((k) => hit.hasAttribute(`data-${k}`));
    const id = hit.getAttribute(`data-${kind}`);
    if (st.sel?.kind !== kind || st.sel.id !== id) select(kind, id);
    const o = selObj();
    if (kind !== 'door' && o) {
      st.drag = { type: 'obj', kind, o, start: pt, ox: o.x, oy: o.y, moved: false };
      svg.setPointerCapture(e.pointerId);
    }
    return;
  }
  const roomEl = e.target.closest?.('.st-room');
  if (roomEl?.dataset.id) { select('room', roomEl.dataset.id); return; }
  if (st.sel) select(null);
}

function onMove(e) {
  const d = st.drag;
  if (!d) return;
  if (d.type === 'pan') {
    const k = st.vb.w / svg.clientWidth;
    setVB({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * k, y: d.vb.y - (e.clientY - d.sy) * k });
    return;
  }
  const pt = toMap(e);
  if (!d.moved && Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 3) return;
  d.moved = true;
  const dx = Math.round(pt.x - d.start.x);
  const dy = Math.round(pt.y - d.start.y);
  d.o.x = d.ox + dx;
  d.o.y = d.oy + dy;
  const node = svg.querySelector(`[data-${d.kind}="${d.o.id}"]`);
  node?.setAttribute('transform', d.kind === 'cam' ? `translate(${dx} ${dy})` : `translate(${d.o.x} ${d.o.y})`);
}

function onUp() {
  const d = st.drag;
  st.drag = null;
  svg.classList.remove('panning');
  if (d?.type !== 'obj' || !d.moved) return;
  if (d.kind === 'cam') commitLayer(false); else { saveTable(t); render(); }
}

function onKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') {
    if (st.place) { cancelPlace(); renderSide(); return; }
    if (typing) { e.target.blur(); return; }
    if (st.big) { st.big = false; renderSide(); return; }
    if (st.sel) select(null);
    return;
  }
  if (typing) return;
  const o = selObj();
  if (!o || st.sel.kind === 'room') return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir) return;
  e.preventDefault();
  if (st.sel.kind === 'token' && o.levelId !== lv.id) return;
  const step = e.shiftKey ? 20 : 5;
  let [dx, dy] = dir.map((n) => n * step);
  if (st.sel.kind === 'door') { if (o.o === 'h') dy = 0; else dx = 0; }
  if (!dx && !dy) return;
  o.x += dx;
  o.y += dy;
  if (isLayerKind(st.sel.kind)) { saveLayer(lv.id, layer); notifyChange(); } else saveTable(t);
  render();
}

// ---------- Start ----------

function fillLevels() {
  levels = allLevels();
  const maps = [...new Set(levels.map((l) => l.mapId))];
  $('#lvl').innerHTML = maps.map((mid) => {
    const ls = levels.filter((l) => l.mapId === mid);
    return `<optgroup label="${esc(ls[0].mapName)}">${ls.slice().reverse().map((l) => `<option value="${l.id}">${esc(l.plan.name)}</option>`).join('')}</optgroup>`;
  }).join('');
}

async function openPlayer() {
  let feat = 'popup,width=1280,height=720';
  try {
    if ('getScreenDetails' in window) {
      const sd = await window.getScreenDetails();
      const other = sd.screens.find((s) => s !== sd.currentScreen);
      if (other) feat = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
    }
  } catch { /* ohne Bildschirm-Erkennung */ }
  const w = window.open('spieler.html', 'apollo-spieler', feat);
  if (!w) toast('POPUP BLOCKIERT – BITTE POPUPS FÜR DIESE SEITE ERLAUBEN');
  else toast('SPIELERFENSTER AUF DEN FERNSEHER ZIEHEN UND DORT „VOLLBILD“ KLICKEN');
}

function sendView() {
  t.player = { levelId: lv.id, vb: { ...st.vb } };
  saveTable(t, true);
  postView(t.player);
  renderPlayerState();
  toast('SPIELER SEHEN JETZT DIESEN AUSSCHNITT');
}

function init() {
  fillLevels();
  bindPanel(side);
  bindPanel(win);
  win.addEventListener('pointerdown', (e) => { if (e.target === win) { st.big = false; renderSide(); } });
  $('#lvl').addEventListener('change', (e) => selectLevel(e.target.value));
  $('#open-player').addEventListener('click', openPlayer);
  $('#send-view').addEventListener('click', sendView);
  const follow = $('#follow');
  follow.checked = !!t.follow;
  follow.addEventListener('change', () => {
    t.follow = follow.checked;
    saveTable(t, true);
    if (t.follow) { setVB(st.vb); toast('SPIELERKARTE LÄUFT LIVE MIT'); }
    renderPlayerState();
  });
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toMap(e);
    const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const w = Math.min(Math.max(st.vb.w * f, 150), 12000);
    const k = w / st.vb.w;
    setVB({ x: p.x - (p.x - st.vb.x) * k, y: p.y - (p.y - st.vb.y) * k, w, h: st.vb.h * k });
  }, { passive: false });
  addEventListener('keydown', onKey);
  addEventListener('resize', () => setVB({ ...st.vb, h: st.vb.w * (svg.clientHeight / svg.clientWidth) }));
  onTableChange(() => {
    if (st.drag) return;
    t = loadTable();
    const id = lv?.id;
    fillLevels();
    lv = levels.find((l) => l.id === id) || startLevel(levels);
    $('#lvl').value = lv.id;
    render();
    if (!side.contains(document.activeElement) && !win.contains(document.activeElement)) renderSide();
  });
  onRoomListChange((kind) => {
    if (kind !== 'remote') return;
    render();
    if (!side.contains(document.activeElement) && !win.contains(document.activeElement)) renderSide();
  });
  roomSync.start();
  let start = null;
  try { start = localStorage.getItem(LV_KEY); } catch { /* egal */ }
  selectLevel(levels.some((l) => l.id === start) ? start : startLevel(levels)?.id);
}

init();
window.__apolloReady = true;
