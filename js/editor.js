// Karten-Editor: Türen, Trennlinien, Kameras und Raumdaten auf einem Stationsplan eintragen.
import { CONFIG, STATION } from './data.js';
import { el } from './svg.js';
import { drawStationPlan, roomName, roomCode, roomZone, liftData, applyZoom, planLabels, roomIdPos, bbox } from './stationplan.js';
import {
  CAM, SECURITY, STATUS, UNITS_PER_M, DESC_FIELDS, MAX_PICTOS, loadLayer, saveLayer, emptyLayer, importLayer,
  snapDoor, roomAt, containerRects, camHandle, roomDoors, roomCams, inRect,
} from './layer.js';
import { SEMIOTIC, semioticSvg, semioticById } from './semiotic.js';
import { equipmentList, equipmentCategories, saveItem, deleteItem, exportEquipment, importEquipment } from './equipment.js';
import { makeOdt } from './odt.js';
import { loadContent, currentContent, saveContent } from './content.js';
import { createContentEditor, CONTENT_TABS } from './content-editor.js';

loadContent();

const LV = STATION.levels[0];
const level = LV.plan;
let layer = loadLayer(LV.id, LV.layer);

const $ = (s) => document.querySelector(s);
const svg = $('#map');
const props = $('#props');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const snap = (v, s = 25) => Math.round(v / s) * s;
const m = (u) => (u / UNITS_PER_M).toFixed(1);

const TOOLS = [
  { id: 'select', key: '1', label: 'AUSWAHL', hint: 'Objekt anklicken zum Auswählen und Verschieben · freie Fläche ziehen = Karte bewegen · Raum anklicken = Raumdaten' },
  { id: 'door', key: '2', label: 'TÜR', hint: 'In einen Gang klicken (Tür quer zum Gang) oder an eine Raumwand (Tür in der Wand). Stufe links wählen.' },
  { id: 'line', key: '3', label: 'TRENNLINIE', hint: 'Anfangspunkt klicken, dann Endpunkt klicken · Esc bricht ab · rastet am Raster ein' },
  { id: 'cam', key: '4', label: 'KAMERA', hint: 'In einen Raum oder Gang klicken · gelben Punkt ziehen = Richtung und Reichweite' },
  { id: 'room', key: '5', label: 'RAUM', hint: 'Raum anklicken: rechts ID, Name, Bereich, Status und Notiz bearbeiten · Raumbeschreibung öffnen' },
  { id: 'erase', key: '6', label: 'RADIERER', hint: 'Tür, Linie oder Kamera anklicken zum Löschen' },
  { id: 'picto', key: '7', label: 'PIKTOGRAMM', hint: 'Piktogramm links auswählen, dann in einen Raum klicken (höchstens 5 pro Raum)' },
  { id: 'label', key: '8', label: 'BESCHRIFTUNG', hint: 'Klicken, um eine neue Beschriftung zu setzen · vorhandene Beschriftungen mit dem Auswahl-Werkzeug anklicken, ändern und verschieben' },
];

const st = {
  tool: 'select',
  sec: 'green',
  picto: 1,
  sel: null,          // { kind: 'door'|'line'|'cam'|'room', id }
  lineStart: null,
  ghost: null,
  drag: null,
  vb: null,
  undo: [],
  redo: [],
};

// ---------- Verlauf und Speichern ----------

function snapshot() {
  st.undo.push(JSON.stringify(layer));
  if (st.undo.length > 100) st.undo.shift();
  st.redo = [];
  updateButtons();
}
function commit() {
  saveLayer(LV.id, layer);
  render();
}
function undo() {
  if (!st.undo.length) return;
  st.redo.push(JSON.stringify(layer));
  layer = JSON.parse(st.undo.pop());
  validateSel();
  commit();
  renderProps();
  updateButtons();
}
function redo() {
  if (!st.redo.length) return;
  st.undo.push(JSON.stringify(layer));
  layer = JSON.parse(st.redo.pop());
  validateSel();
  commit();
  renderProps();
  updateButtons();
}
function updateButtons() {
  $('#undo').disabled = !st.undo.length;
  $('#redo').disabled = !st.redo.length;
}
function validateSel() {
  if (st.sel && !['room', 'lift'].includes(st.sel.kind) && !find(st.sel.kind, st.sel.id)) st.sel = null;
}

const roomById = (id) => level.rooms.find((r) => r.id === id);

// Raumdaten ändern; leere Angaben werden entfernt
function patchRoom(id, patch) {
  const d = { ...(layer.rooms[id] || {}), ...patch };
  for (const k of Object.keys(d)) {
    if (d[k] === '' || d[k] == null || (Array.isArray(d[k]) && !d[k].length)) delete d[k];
  }
  if (Object.keys(d).length) layer.rooms[id] = d; else delete layer.rooms[id];
}
function patchLift(id, patch) {
  const d = { ...(layer.lifts[id] || {}), ...patch };
  for (const k of Object.keys(d)) if (d[k] === '' || d[k] == null) delete d[k];
  if (Object.keys(d).length) layer.lifts[id] = d; else delete layer.lifts[id];
}

const listOf = (kind) => ({ door: layer.doors, line: layer.lines, cam: layer.cams }[kind]);
const find = (kind, id) => (kind === 'label' ? planLabels(level, layer).find((l) => l.id === id) : listOf(kind)?.find((o) => o.id === id));
function patchLabel(id, patch) {
  layer.labels[id] = { ...(layer.labels[id] || {}), ...patch };
}

function remove(kind, id) {
  if (kind === 'label') {
    snapshot();
    if (layer.labels[id]?.custom) delete layer.labels[id];
    else patchLabel(id, { hidden: true });
    if (st.sel?.id === id) st.sel = null;
    commit();
    renderProps();
    return;
  }
  const list = listOf(kind);
  const i = list.findIndex((o) => o.id === id);
  if (i < 0) return;
  snapshot();
  list.splice(i, 1);
  if (st.sel?.id === id) st.sel = null;
  commit();
  renderProps();
}

let toastTimer = 0;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- Ansicht ----------

function setVB(r) {
  st.vb = r;
  svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`);
  applyZoom(svg, r.w / (svg.clientWidth || 1000));
}

function homeView() {
  const b = level.bounds;
  const w = svg.clientWidth || 1000;
  const h = svg.clientHeight || 600;
  const pad = 80;
  let vw = b[2] - b[0] + pad * 2;
  let vh = b[3] - b[1] + pad * 2;
  if (vh / vw > h / w) vw = vh * (w / h); else vh = vw * (h / w);
  setVB({ x: (b[0] + b[2]) / 2 - vw / 2, y: (b[1] + b[3]) / 2 - vh / 2, w: vw, h: vh });
}

function zoomAt(factor, cx, cy) {
  const r = st.vb;
  const w = Math.min(Math.max(r.w * factor, 300), 9000);
  const k = w / r.w;
  setVB({ x: cx - (cx - r.x) * k, y: cy - (cy - r.y) * k, w, h: r.h * k });
}

function toMap(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return { x: q.x, y: q.y };
}

// ---------- Zeichnen ----------

let ui = null;
function render() {
  svg.replaceChildren();
  const g = el('g', {}, svg);
  const info = drawStationPlan(g, CONFIG, level, layer, { cams: true, editor: true });
  ui = el('g', {}, svg);
  // Auswahl markieren
  if (st.sel?.kind === 'room') info.plan.nodes[st.sel.id]?.classList.add('sel');
  else if (st.sel?.kind === 'lift') svg.querySelector(`[data-lift="${st.sel.id}"]`)?.classList.add('ed-sel');
  else if (st.sel) info.plan.objects[st.sel.id]?.classList.add('ed-sel');
  const cam = st.sel?.kind === 'cam' ? find('cam', st.sel.id) : null;
  if (cam) {
    const h = camHandle(cam);
    el('line', { x1: cam.x, y1: cam.y, x2: h.x, y2: h.y, class: 'ed-preview' }, ui);
    el('circle', { cx: h.x, cy: h.y, r: 9, class: 'ed-handle', 'data-handle': cam.id }, ui);
  }
  drawUi();
  $('#showcams').checked = !!layer.settings.showCams;
}

// Vorschau: Tür-Geist, Linienvorschau (wird bei Mausbewegung aktualisiert)
let uiTemp = null;
function drawUi(pt) {
  if (!ui) return;
  uiTemp?.remove();
  uiTemp = el('g', {}, ui);
  if (!pt) return;
  if (st.tool === 'door') {
    const d = snapDoor(level, pt.x, pt.y);
    if (d) {
      const r = d.o === 'h' ? { x: d.x - d.len / 2, y: d.y - 4.5, width: d.len, height: 9 } : { x: d.x - 4.5, y: d.y - d.len / 2, width: 9, height: d.len };
      el('rect', { ...r, class: `ly-door sec-${st.sec} ed-ghost` }, uiTemp);
    }
  } else if (st.tool === 'line') {
    const p = { x: snap(pt.x), y: snap(pt.y) };
    if (st.lineStart) {
      const q = ortho(st.lineStart, p);
      el('line', { x1: st.lineStart.x, y1: st.lineStart.y, x2: q.x, y2: q.y, class: 'ed-preview' }, uiTemp);
    }
    el('circle', { cx: p.x, cy: p.y, r: 5, class: 'ed-snapdot' }, uiTemp);
  }
}

// Fast waagrecht/senkrecht → exakt waagrecht/senkrecht
function ortho(a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dy < dx * 0.18) return { x: b.x, y: a.y };
  if (dx < dy * 0.18) return { x: a.x, y: b.y };
  return b;
}

// ---------- Eigenschaften ----------

function renderProps() {
  const sel = st.sel;
  if (!sel) {
    const t = TOOLS.find((x) => x.id === st.tool);
    props.innerHTML = `
      <h3>LEVEL 0</h3>
      <div class="ed-row"><span class="dim">TÜREN</span><span>${layer.doors.length}</span></div>
      <div class="ed-row"><span class="dim">TRENNLINIEN</span><span>${layer.lines.length}</span></div>
      <div class="ed-row"><span class="dim">KAMERAS</span><span>${layer.cams.length}</span></div>
      <div class="ed-row"><span class="dim">BENANNTE RÄUME</span><span>${Object.values(layer.rooms).filter((r) => r.name).length}</span></div>
      <p class="ed-note">${esc(t.hint)}</p>
      <p class="ed-note"><b>Sicherheitsstufen</b><br>
        <span class="sec-t sec-green">GRÜN</span> – offen für alle<br>
        <span class="sec-t sec-orange">ORANGE</span> – Karte nötig, kein Zugang zu lebenswichtiger Infrastruktur und Mainframe<br>
        <span class="sec-t sec-red">ROT</span> – Vollzugriff</p>`;
    return;
  }
  if (sel.kind === 'label') {
    const l = find('label', sel.id);
    props.innerHTML = `
      <h3>BESCHRIFTUNG</h3>
      <label class="ed-field">TEXT <input type="text" data-lt maxlength="60" value="${esc(l.text)}"></label>
      <div class="ed-btns"><button class="danger" data-del>BESCHRIFTUNG LÖSCHEN</button>${layer.labels[l.id] && !layer.labels[l.id].custom ? '<button data-lreset>ORIGINAL WIEDERHERSTELLEN</button>' : ''}</div>
      <p class="ed-note">Mit dem Auswahl-Werkzeug ziehen, um die Beschriftung zu verschieben. Neue Beschriftungen setzt das Werkzeug 8.</p>`;
    const inp = props.querySelector('[data-lt]');
    inp.addEventListener('focus', snapshot);
    inp.addEventListener('input', () => { patchLabel(l.id, { text: inp.value }); commit(); });
    props.querySelector('[data-lreset]')?.addEventListener('click', () => { snapshot(); delete layer.labels[l.id]; commit(); renderProps(); });
  } else if (sel.kind === 'door') {
    const d = find('door', sel.id);
    props.innerHTML = `
      <h3>TÜR</h3>
      <div class="ed-row"><span class="dim">POSITION</span><span>${m(d.x)} / ${m(d.y)} M</span></div>
      <div class="ed-row"><span class="dim">BREITE</span><span>${m(d.len)} M</span></div>
      <div class="ed-field">SICHERHEITSSTUFE</div>
      <div class="ed-secs">${Object.entries(SECURITY).map(([k, v]) => `<button class="ed-sec ${d.sec === k ? 'on' : ''}" data-sec="${k}"><i style="background:var(--sec-${k})"></i>${v.label} <span class="dim">${v.text}</span></button>`).join('')}</div>
      <div class="ed-btns"><button class="danger" data-del>TÜR LÖSCHEN</button></div>
      <p class="ed-note">Mit dem Auswahl-Werkzeug ziehen, um die Tür zu verschieben. Tasten G / O / R ändern die Stufe.</p>`;
    props.querySelectorAll('[data-sec]').forEach((b) => b.addEventListener('click', () => setDoorSec(d, b.dataset.sec)));
  } else if (sel.kind === 'cam') {
    const c = find('cam', sel.id);
    props.innerHTML = `
      <h3>KAMERA</h3>
      <div class="ed-row"><span class="dim">POSITION</span><span>${m(c.x)} / ${m(c.y)} M</span></div>
      <div class="ed-row"><span class="dim">ÖFFNUNGSWINKEL</span><span>${CAM.fov}° (FEST)</span></div>
      <label class="ed-field">RICHTUNG <span class="ed-val" id="v-dir">${Math.round(c.dir)}°</span>
        <input type="range" min="0" max="355" step="5" value="${Math.round(((c.dir % 360) + 360) % 360)}" data-k="dir"></label>
      <label class="ed-field">REICHWEITE <span class="ed-val" id="v-range">${m(c.range)} M</span>
        <input type="range" min="${CAM.min}" max="${CAM.max}" step="10" value="${c.range}" data-k="range"></label>
      <div class="ed-btns"><button class="danger" data-del>KAMERA LÖSCHEN</button></div>
      <p class="ed-note">Den gelben Punkt am Kegel ziehen, um Richtung und Reichweite direkt in der Karte zu ändern. Der Kegel endet an den Wänden des Raums bzw. Gangs.</p>`;
    props.querySelectorAll('input[type=range]').forEach((inp) => {
      inp.addEventListener('pointerdown', snapshot);
      inp.addEventListener('keydown', snapshot, { once: true });
      inp.addEventListener('input', () => {
        c[inp.dataset.k] = Number(inp.value);
        $('#v-dir').textContent = `${Math.round(c.dir)}°`;
        $('#v-range').textContent = `${m(c.range)} M`;
        commit();
      });
    });
  } else if (sel.kind === 'line') {
    const l = find('line', sel.id);
    props.innerHTML = `
      <h3>TRENNLINIE</h3>
      <div class="ed-row"><span class="dim">LÄNGE</span><span>${m(Math.hypot(l.x2 - l.x1, l.y2 - l.y1))} M</span></div>
      <div class="ed-btns"><button class="danger" data-del>LINIE LÖSCHEN</button></div>
      <p class="ed-note">Mit dem Auswahl-Werkzeug ziehen, um die Linie zu verschieben.</p>`;
  } else if (sel.kind === 'room') {
    const room = roomById(sel.id);
    const data = layer.rooms[room.id] || {};
    const doors = roomDoors(layer, room);
    const pics = data.picto || [];
    props.innerHTML = `
      <h3>${esc(roomName(level, room, layer))}</h3>
      <div class="ed-row"><span class="dim">TÜREN</span><span>${doors.length}</span></div>
      <div class="ed-row"><span class="dim">KAMERAS</span><span>${roomCams(layer, room).length}</span></div>
      <div class="ed-crow ed-idrow"><label class="ed-field">RAUM-ID <input type="text" data-k="code" maxlength="20" value="${esc(data.code)}" placeholder="${esc(room.id)}"></label><label class="ed-field ed-checkf" title="Raum-ID auf der Karte anzeigen (im Raum verschiebbar)"><input type="checkbox" data-showid ${data.showId ? 'checked' : ''}> AUF KARTE</label></div>
      <label class="ed-field">NAME <input type="text" data-k="name" maxlength="40" value="${esc(data.name)}" placeholder="${esc(roomName(level, room, { rooms: {} }))}"></label>
      <label class="ed-field">BEREICH <input type="text" data-k="zoneName" maxlength="40" value="${esc(data.zoneName)}" placeholder="${esc(level.zones[room.zone] || room.zone)}"></label>
      <label class="ed-field">STATUS <select data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(data.status || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="ed-field">NOTIZ (ERSCHEINT IM TERMINAL) <textarea data-k="info" maxlength="300">${esc(data.info)}</textarea></label>
      <div class="ed-field">PIKTOGRAMME (${pics.length}/${MAX_PICTOS})</div>
      <div class="ed-pics">${pics.map((p) => `<span class="ed-pic ${p.map ? 'on-map' : ''}" title="${esc(semioticById(p.id)?.name)}${p.map ? ' · auf der Karte' : ''}">${semioticSvg(p.id, 34)}</span>`).join('') || '<span class="dim">KEINE</span>'}</div>
      <div class="ed-btns"><button data-detail>RAUMBESCHREIBUNG ÖFFNEN ▸</button><button data-reset>ZURÜCKSETZEN</button></div>`;
    bindRoomFields(props, room);
    props.querySelector('[data-detail]').addEventListener('click', () => openDetail(room.id));
    props.querySelector('[data-reset]').addEventListener('click', () => {
      if (!confirm('Alle Angaben zu diesem Raum löschen?')) return;
      snapshot();
      delete layer.rooms[room.id];
      commit();
      renderProps();
    });
  } else if (sel.kind === 'lift') {
    const lift = level.lifts.find((l) => l.id === sel.id);
    const data = liftData(lift, layer);
    props.innerHTML = `
      <h3>AUFZUG ${esc(data.letter || lift.id)}</h3>
      <label class="ed-field">BUCHSTABE <input type="text" data-k="letter" maxlength="12" value="${esc(layer.lifts[lift.id]?.letter)}" placeholder="${esc(lift.id)}"></label>
      <div class="ed-field">SICHERHEITSSTUFE</div>
      <div class="ed-secs">
        <button class="ed-sec ${!data.sec ? 'on' : ''}" data-lsec=""><i style="background:transparent;border:1px solid var(--amber-dim)"></i>KEINE ANGABE</button>
        ${Object.entries(SECURITY).map(([k, v]) => `<button class="ed-sec ${data.sec === k ? 'on' : ''}" data-lsec="${k}"><i style="background:var(--sec-${k})"></i>${v.label}</button>`).join('')}
      </div>
      <label class="ed-field">ZUGANG ZU <textarea data-k="access" maxlength="400" placeholder="z. B. LEVEL -1 · APOLLO MAINFRAME">${esc(data.access)}</textarea></label>`;
    props.querySelectorAll('[data-k]').forEach((inp) => {
      inp.addEventListener('focus', snapshot);
      inp.addEventListener('input', () => { patchLift(lift.id, { [inp.dataset.k]: inp.value.trim() ? inp.value : '' }); commit(); });
    });
    props.querySelectorAll('[data-lsec]').forEach((b) => b.addEventListener('click', () => {
      snapshot();
      patchLift(lift.id, { sec: b.dataset.lsec });
      commit();
      renderProps();
    }));
  }
  props.querySelector('[data-del]')?.addEventListener('click', () => remove(sel.kind, sel.id));
}

function bindRoomFields(root, room) {
  root.querySelectorAll('[data-showid]').forEach((cb) => cb.addEventListener('change', () => {
    snapshot();
    patchRoom(room.id, { showId: cb.checked || '' });
    commit();
    root.querySelectorAll('[data-showid]').forEach((o) => { o.checked = cb.checked; });
  }));
  root.querySelectorAll('[data-k]').forEach((inp) => {
    inp.addEventListener('focus', snapshot);
    inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      patchRoom(room.id, { [inp.dataset.k]: inp.value.trim() ? inp.value : '' });
      commit();
      root.querySelectorAll('[data-title]').forEach((t) => { t.textContent = roomName(level, room, layer); });
      const h = props.querySelector('h3');
      if (h && st.sel?.id === room.id) h.textContent = roomName(level, room, layer);
    });
  });
}

function setDoorSec(d, sec) {
  snapshot();
  d.sec = sec;
  commit();
  renderProps();
}

function select(sel) {
  st.sel = sel;
  render();
  renderProps();
}

// ---------- Werkzeuge ----------

function setTool(id) {
  st.tool = id;
  st.lineStart = null;
  svg.classList.toggle('tool-select', id === 'select');
  document.querySelectorAll('.ed-tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === id));
  $('#pictos').hidden = id !== 'picto';
  drawUi();
  if (!st.sel) renderProps();
}

function setSec(sec) {
  st.sec = sec;
  document.querySelectorAll('#secs .ed-sec').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
  if (st.sel?.kind === 'door') setDoorSec(find('door', st.sel.id), sec);
}

function objectAt(e) {
  const t = e.target.closest?.('[data-oid]');
  return t ? { kind: t.dataset.kind, id: t.dataset.oid } : null;
}

function onDown(e) {
  if (e.button === 1 || e.button === 2) { startPan(e); return; }
  if (e.button !== 0) return;
  const pt = toMap(e);

  const handle = e.target.closest?.('[data-handle]');
  if (handle) {
    snapshot();
    st.drag = { type: 'handle', id: handle.dataset.handle };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  const liftEl = e.target.closest?.('[data-lift]');
  if (liftEl && (st.tool === 'select' || st.tool === 'room')) { select({ kind: 'lift', id: liftEl.dataset.lift }); return; }

  if (st.tool === 'select') {
    const obj = objectAt(e);
    if (obj?.kind === 'rid') {
      // Raum-ID: Raum wählen, Beschriftung innerhalb des Raums ziehen
      select({ kind: 'room', id: obj.id });
      st.drag = { type: 'rid', id: obj.id, start: pt, orig: roomIdPos(roomById(obj.id), layer), moved: false };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (obj) {
      select(obj);
      st.drag = { type: 'move', start: pt, orig: JSON.stringify(find(obj.kind, obj.id)), moved: false };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    startPan(e, true);
    return;
  }
  if (st.tool === 'erase') {
    const obj = objectAt(e);
    if (obj) remove(obj.kind, obj.id);
    return;
  }
  if (st.tool === 'door') {
    const d = snapDoor(level, pt.x, pt.y);
    if (!d) { toast('HIER KANN KEINE TÜR SITZEN – IN EINEN GANG ODER AN EINE RAUMWAND KLICKEN'); return; }
    snapshot();
    const door = { id: uid('d'), ...d, sec: st.sec };
    layer.doors.push(door);
    st.sel = { kind: 'door', id: door.id };
    commit();
    renderProps();
    return;
  }
  if (st.tool === 'line') {
    const p = { x: snap(pt.x), y: snap(pt.y) };
    if (!st.lineStart) { st.lineStart = p; drawUi(pt); return; }
    const q = ortho(st.lineStart, p);
    if (Math.hypot(q.x - st.lineStart.x, q.y - st.lineStart.y) >= 10) {
      snapshot();
      const line = { id: uid('l'), x1: st.lineStart.x, y1: st.lineStart.y, x2: q.x, y2: q.y };
      layer.lines.push(line);
      st.sel = { kind: 'line', id: line.id };
      commit();
      renderProps();
    }
    st.lineStart = null;
    drawUi(pt);
    return;
  }
  if (st.tool === 'cam') {
    const obj = objectAt(e);
    if (obj?.kind === 'cam') { select(obj); return; }
    if (!containerRects(level, pt.x, pt.y)) { toast('KAMERAS NUR IN RÄUMEN ODER GÄNGEN'); return; }
    snapshot();
    const cam = { id: uid('c'), x: Math.round(pt.x / 5) * 5, y: Math.round(pt.y / 5) * 5, dir: 0, range: CAM.def };
    layer.cams.push(cam);
    st.sel = { kind: 'cam', id: cam.id };
    commit();
    renderProps();
    return;
  }
  if (st.tool === 'room') {
    const room = roomAt(level, pt.x, pt.y);
    if (room) select({ kind: 'room', id: room.id });
    else toast('KEIN RAUM AN DIESER STELLE');
    return;
  }
  if (st.tool === 'label') {
    const obj = objectAt(e);
    if (obj?.kind === 'label') { select(obj); return; }
    snapshot();
    const id = uid('lbl');
    layer.labels[id] = { custom: true, text: 'NEUER BEREICH', x: Math.round(pt.x), y: Math.round(pt.y) };
    st.sel = { kind: 'label', id };
    commit();
    renderProps();
    props.querySelector('[data-lt]')?.select();
    return;
  }
  if (st.tool === 'picto') {
    const room = roomAt(level, pt.x, pt.y);
    if (!room) { toast('PIKTOGRAMME NUR IN RÄUMEN'); return; }
    addPicto(room.id, st.picto, true);
    select({ kind: 'room', id: room.id });
  }
}

function addPicto(roomId, pid, map) {
  const pics = [...(layer.rooms[roomId]?.picto || [])];
  if (pics.some((p) => p.id === pid)) { toast('DIESES PIKTOGRAMM HAT DER RAUM SCHON'); return false; }
  if (pics.length >= MAX_PICTOS) { toast(`HÖCHSTENS ${MAX_PICTOS} PIKTOGRAMME PRO RAUM`); return false; }
  snapshot();
  pics.push({ id: pid, map });
  patchRoom(roomId, { picto: pics });
  commit();
  return true;
}

// ---------- Raumbeschreibung (eigenes Fenster) ----------

const detail = $('#detail');
let detailRoom = null;

function openDetail(id) {
  detailRoom = id;
  detail.hidden = false;
  renderDetail();
}
function closeDetail() {
  detail.hidden = true;
  detailRoom = null;
  renderProps();
}

function renderDetail() {
  const room = roomById(detailRoom);
  if (!room) return;
  const data = layer.rooms[room.id] || {};
  const doors = roomDoors(layer, room);
  const pics = data.picto || [];
  const items = data.items || [];
  const field = (k, label, max = 3000) => `<label class="ed-field">${label}<textarea data-k="${k}" maxlength="${max}">${esc(data[k])}</textarea></label>`;
  detail.innerHTML = `
    <div class="ed-dwin">
      <header class="ed-dhead">
        <div><span class="dim">RAUMBESCHREIBUNG // ${esc(level.name)}</span><h2 data-title>${esc(roomName(level, room, layer))}</h2></div>
        <button data-close>SCHLIESSEN ✕</button>
      </header>
      <div class="ed-dbody">
        <section class="ed-dcol">
          <div class="ed-head">RAUMDATEN</div>
          <div class="ed-crow ed-idrow"><label class="ed-field">RAUM-ID <input type="text" data-k="code" maxlength="20" value="${esc(data.code)}" placeholder="${esc(room.id)}"></label><label class="ed-field ed-checkf" title="Raum-ID auf der Karte anzeigen (im Raum verschiebbar)"><input type="checkbox" data-showid ${data.showId ? 'checked' : ''}> AUF KARTE</label></div>
          <label class="ed-field">NAME <input type="text" data-k="name" maxlength="40" value="${esc(data.name)}" placeholder="${esc(roomName(level, room, { rooms: {} }))}"></label>
          <label class="ed-field">BEREICH <input type="text" data-k="zoneName" maxlength="40" value="${esc(data.zoneName)}" placeholder="${esc(level.zones[room.zone] || room.zone)}"></label>
          <label class="ed-field">STATUS <select data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(data.status || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <div class="ed-row"><span class="dim">EBENE</span><span>${esc(level.name)}</span></div>
          <div class="ed-row"><span class="dim">TÜREN</span><span>${doors.length}${doors.length ? ` · ${['green', 'orange', 'red'].map((k) => { const n = doors.filter((d) => (d.sec || 'green') === k).length; return n ? `<span class="sec-t sec-${k}">${n}× ${SECURITY[k].label}</span>` : ''; }).filter(Boolean).join(' ')}` : ''}</span></div>
          <div class="ed-row"><span class="dim">KAMERAS</span><span>${roomCams(layer, room).length}</span></div>
          <label class="ed-field">NOTIZ (ERSCHEINT IM TERMINAL) <textarea data-k="info" maxlength="300">${esc(data.info)}</textarea></label>

          <div class="ed-head">PIKTOGRAMME (${pics.length}/${MAX_PICTOS})</div>
          <div class="ed-dpics">
            ${pics.map((p, i) => `<div class="ed-dpic">${semioticSvg(p.id, 54)}<div><b>${esc(semioticById(p.id)?.name)}</b><br><span class="dim">${esc(semioticById(p.id)?.de)}</span>
              <label class="ed-check"><input type="checkbox" data-pmap="${i}" ${p.map ? 'checked' : ''}> AUF DER KARTE ZEIGEN</label></div>
              <button class="danger" data-pdel="${i}" title="Entfernen">✕</button></div>`).join('') || '<p class="dim">Noch keine Piktogramme. Unten anklicken, um sie hinzuzufügen.</p>'}
          </div>
          <div class="ed-palette">${SEMIOTIC.map((sm) => `<button class="ed-pal" data-padd="${sm.id}" title="${sm.id}. ${esc(sm.name)} – ${esc(sm.de)}" ${pics.length >= MAX_PICTOS || pics.some((p) => p.id === sm.id) ? 'disabled' : ''}>${semioticSvg(sm.id, 38)}</button>`).join('')}</div>
        </section>
        <section class="ed-dcol wide">
          <div class="ed-head">BESCHREIBUNG</div>
          ${DESC_FIELDS.map(([k, label]) => field(k, label)).join('')}
          <div class="ed-head">WAS FÜR GEGENSTÄNDE FINDET MAN</div>
          <table class="ed-items">
            <thead><tr><th>GEGENSTAND</th><th>ANZAHL</th><th>NOTIZ</th><th></th></tr></thead>
            <tbody>${items.map((it, i) => `<tr>
              <td><input type="text" data-item="${i}" data-f="name" value="${esc(it.name)}" list="eq-list"></td>
              <td><input type="text" data-item="${i}" data-f="qty" value="${esc(it.qty)}" class="qty"></td>
              <td><input type="text" data-item="${i}" data-f="note" value="${esc(it.note)}"></td>
              <td><button class="danger" data-idel="${i}" title="Entfernen">✕</button></td></tr>`).join('')}
            </tbody>
          </table>
          <div class="ed-additem">
            <input type="text" id="eq-search" list="eq-list" placeholder="Gegenstand suchen oder frei eintippen …">
            <input type="text" id="eq-qty" class="qty" placeholder="Anz.">
            <button id="eq-add">HINZUFÜGEN</button>
            <button id="eq-manage">AUSRÜSTUNGSLISTE BEARBEITEN</button>
          </div>
          <datalist id="eq-list">${equipmentList().map((it) => `<option value="${esc(it.name)}">${esc(it.cat)}</option>`).join('')}</datalist>
          <p class="ed-note" id="eq-info"></p>
        </section>
      </div>
    </div>`;
  bindRoomFields(detail, room);
  detail.querySelector('[data-close]').addEventListener('click', closeDetail);
  detail.querySelectorAll('[data-pmap]').forEach((c) => c.addEventListener('change', () => {
    snapshot();
    const p = pics.map((x, i) => (i === Number(c.dataset.pmap) ? { ...x, map: c.checked } : x));
    patchRoom(room.id, { picto: p });
    commit();
  }));
  detail.querySelectorAll('[data-pdel]').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    patchRoom(room.id, { picto: pics.filter((_, i) => i !== Number(b.dataset.pdel)) });
    commit();
    renderDetail();
  }));
  detail.querySelectorAll('[data-padd]').forEach((b) => b.addEventListener('click', () => {
    if (addPicto(room.id, Number(b.dataset.padd), !pics.some((p) => p.map))) renderDetail();
  }));
  detail.querySelectorAll('[data-item]').forEach((inp) => {
    inp.addEventListener('focus', snapshot);
    inp.addEventListener('input', () => {
      const list = (layer.rooms[room.id]?.items || []).map((x) => ({ ...x }));
      list[Number(inp.dataset.item)][inp.dataset.f] = inp.value;
      patchRoom(room.id, { items: list });
      commit();
    });
  });
  detail.querySelectorAll('[data-idel]').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    patchRoom(room.id, { items: items.filter((_, i) => i !== Number(b.dataset.idel)) });
    commit();
    renderDetail();
  }));
  const search = detail.querySelector('#eq-search');
  const showInfo = () => {
    const it = equipmentList().find((x) => x.name.toLowerCase() === search.value.trim().toLowerCase());
    detail.querySelector('#eq-info').textContent = it ? `${it.cat}${it.weight ? ` · Gewicht ${it.weight}` : ''}${it.cost ? ` · ${it.cost}` : ''}${it.effect ? ` · ${it.effect}` : ''}` : '';
  };
  search.addEventListener('input', showInfo);
  const add = () => {
    const name = search.value.trim();
    if (!name) return;
    snapshot();
    patchRoom(room.id, { items: [...items, { name, qty: detail.querySelector('#eq-qty').value.trim() || '1', note: '' }] });
    commit();
    renderDetail();
    detail.querySelector('#eq-search').focus();
  };
  detail.querySelector('#eq-add').addEventListener('click', add);
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  detail.querySelector('#eq-manage').addEventListener('click', openEquip);
}

// ---------- Ausrüstungsliste bearbeiten ----------

const equip = $('#equip');
let equipEdit = null;

function openEquip() { equip.hidden = false; equipEdit = null; renderEquip(''); }
function closeEquip() { equip.hidden = true; if (detailRoom) renderDetail(); }

function renderEquip(filter) {
  const q = filter.trim().toLowerCase();
  const list = equipmentList().filter((it) => !q || `${it.name} ${it.cat} ${it.effect}`.toLowerCase().includes(q));
  const e = equipEdit || { id: '', name: '', cat: 'Other Equipment', weight: '', cost: '', effect: '' };
  equip.innerHTML = `
    <div class="ed-dwin">
      <header class="ed-dhead"><div><span class="dim">EDITOR</span><h2>AUSRÜSTUNGSLISTE</h2></div><button data-close>FERTIG ✕</button></header>
      <div class="ed-dbody">
        <section class="ed-dcol">
          <div class="ed-head">${e.id ? 'EINTRAG BEARBEITEN' : 'NEUER EINTRAG'}</div>
          <label class="ed-field">NAME <input type="text" id="q-name" value="${esc(e.name)}"></label>
          <label class="ed-field">KATEGORIE <input type="text" id="q-cat" value="${esc(e.cat)}" list="q-cats"></label>
          <datalist id="q-cats">${equipmentCategories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
          <label class="ed-field">GEWICHT <input type="text" id="q-weight" value="${esc(e.weight)}"></label>
          <label class="ed-field">KOSTEN <input type="text" id="q-cost" value="${esc(e.cost)}"></label>
          <label class="ed-field">EFFEKT / NOTIZ <textarea id="q-effect">${esc(e.effect)}</textarea></label>
          <div class="ed-btns">
            <button id="q-save">SPEICHERN</button>
            ${e.id ? '<button id="q-new">NEUER EINTRAG</button><button class="danger" id="q-del">LÖSCHEN</button>' : ''}
          </div>
          <p class="ed-note">Einträge aus dem Katalog lassen sich ändern oder ausblenden. Eigene Einträge werden mit exportiert.</p>
        </section>
        <section class="ed-dcol wide">
          <input type="text" id="q-filter" class="ed-search" placeholder="Suchen …" value="${esc(filter)}">
          <table class="ed-items eq">
            <thead><tr><th>NAME</th><th>KATEGORIE</th><th>GEWICHT</th><th>KOSTEN</th></tr></thead>
            <tbody>${list.map((it) => `<tr data-eq="${esc(it.id)}" class="${equipEdit?.id === it.id ? 'on' : ''}"><td>${esc(it.name)}${it.base ? '' : ' <span class="dim">(eigen)</span>'}</td><td>${esc(it.cat)}</td><td>${esc(it.weight)}</td><td>${esc(it.cost)}</td></tr>`).join('')}</tbody>
          </table>
        </section>
      </div>
    </div>`;
  equip.querySelector('[data-close]').addEventListener('click', closeEquip);
  const f = equip.querySelector('#q-filter');
  f.addEventListener('input', () => { renderEquip(f.value); const n = equip.querySelector('#q-filter'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
  equip.querySelectorAll('[data-eq]').forEach((tr) => tr.addEventListener('click', () => {
    equipEdit = equipmentList().find((x) => x.id === tr.dataset.eq);
    renderEquip(f.value);
  }));
  equip.querySelector('#q-save').addEventListener('click', () => {
    const id = saveItem({
      id: e.id, name: equip.querySelector('#q-name').value, cat: equip.querySelector('#q-cat').value,
      weight: equip.querySelector('#q-weight').value, cost: equip.querySelector('#q-cost').value, effect: equip.querySelector('#q-effect').value,
    });
    if (!id) { toast('BITTE EINEN NAMEN EINTRAGEN'); return; }
    equipEdit = equipmentList().find((x) => x.id === id) || null;
    toast('GESPEICHERT');
    renderEquip(f.value);
  });
  equip.querySelector('#q-new')?.addEventListener('click', () => { equipEdit = null; renderEquip(f.value); });
  equip.querySelector('#q-del')?.addEventListener('click', () => {
    if (!confirm(`„${e.name}“ aus der Liste entfernen?`)) return;
    deleteItem(e.id);
    equipEdit = null;
    renderEquip(f.value);
  });
}

function startPan(e, clickSelectsRoom = false) {
  st.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: { ...st.vb }, moved: false, clickSelectsRoom, pt: toMap(e) };
  svg.setPointerCapture(e.pointerId);
}

function onMove(e) {
  const pt = toMap(e);
  const d = st.drag;
  if (!d) { drawUi(pt); return; }
  if (d.type === 'pan') {
    const k = st.vb.w / svg.clientWidth;
    const dx = (e.clientX - d.sx) * k;
    const dy = (e.clientY - d.sy) * k;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) { d.moved = true; svg.classList.add('panning'); }
    setVB({ ...d.vb, x: d.vb.x - dx, y: d.vb.y - dy });
    return;
  }
  if (d.type === 'handle') {
    const c = find('cam', d.id);
    c.dir = Math.round(((Math.atan2(pt.y - c.y, pt.x - c.x) * 180) / Math.PI + 360) % 360 / 5) * 5;
    c.range = Math.min(CAM.max, Math.max(CAM.min, Math.round(Math.hypot(pt.x - c.x, pt.y - c.y) / 10) * 10));
    render();
    return;
  }
  if (d.type === 'rid') {
    if (!d.moved) {
      if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 4) return;
      d.moved = true;
      snapshot();
    }
    const room = roomById(d.id);
    const b = bbox(room.rects);
    const x = Math.round(Math.min(b[2] - 8, Math.max(b[0], d.orig.x + pt.x - d.start.x)));
    const y = Math.round(Math.min(b[3] - 8, Math.max(b[1], d.orig.y + pt.y - d.start.y)));
    if (room.rects.some((r) => inRect(r, x + 2, y + 2))) { patchRoom(d.id, { idPos: { x, y } }); render(); }
    return;
  }
  if (d.type === 'move' && st.sel) {
    const obj = find(st.sel.kind, st.sel.id);
    const orig = JSON.parse(d.orig);
    if (!d.moved) {
      if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 4) return;
      d.moved = true;
      snapshot();
    }
    if (st.sel.kind === 'label') {
      patchLabel(st.sel.id, { x: Math.round(orig.x + pt.x - d.start.x), y: Math.round(orig.y + pt.y - d.start.y) });
    } else if (st.sel.kind === 'door') {
      const s = snapDoor(level, pt.x, pt.y);
      if (s) Object.assign(obj, s);
    } else if (st.sel.kind === 'cam') {
      obj.x = Math.round(pt.x / 5) * 5;
      obj.y = Math.round(pt.y / 5) * 5;
    } else if (st.sel.kind === 'line') {
      const dx = snap(pt.x - d.start.x);
      const dy = snap(pt.y - d.start.y);
      Object.assign(obj, { x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy });
    }
    render();
  }
}

function onUp(e) {
  const d = st.drag;
  st.drag = null;
  svg.classList.remove('panning');
  if (!d) return;
  if (d.type === 'pan' && !d.moved && d.clickSelectsRoom) {
    const room = roomAt(level, d.pt.x, d.pt.y);
    select(room ? { kind: 'room', id: room.id } : null);
    return;
  }
  if (d.type === 'handle' || ((d.type === 'move' || d.type === 'rid') && d.moved)) {
    commit();
    renderProps();
  }
  try { svg.releasePointerCapture(e.pointerId); } catch { /* egal */ }
}

// ---------- Export / Import ----------

function exportLayer() {
  download(new Blob([JSON.stringify({ format: 'apollo-map-layer', level: LV.id, version: 4, layer, equipment: exportEquipment(), content: currentContent() }, null, 2)], { type: 'application/json' }), `apollo-${LV.id}-karte.json`);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// ---------- Raumliste (PDF über Druckansicht, ODT als Datei) ----------

function roomEntries() {
  return level.rooms.map((room) => {
    const d = layer.rooms[room.id] || {};
    const doors = roomDoors(layer, room);
    return {
      room, d,
      code: roomCode(room, layer),
      name: roomName(level, room, layer),
      zone: roomZone(level, room, layer),
      doors: doors.length ? `${doors.length} (${['green', 'orange', 'red'].map((k) => { const n = doors.filter((x) => (x.sec || 'green') === k).length; return n ? `${n}× ${SECURITY[k].label}` : ''; }).filter(Boolean).join(', ')})` : '0',
      cams: roomCams(layer, room).length,
    };
  }).sort((a, b) => a.zone.localeCompare(b.zone) || a.code.localeCompare(b.code, 'de', { numeric: true }));
}

const DESC_LABELS = {
  aesthetic: 'Allgemeine Ästhetik & Designprinzipien',
  smell: 'Was riecht man',
  sight: 'Was sieht man',
  sound: 'Was hört man',
  investigate: 'Was erfährt man nach genauerer Untersuchung',
};

function roomListBlocks() {
  const blocks = [{ h: 1, text: `${CONFIG.station} – Raumliste ${level.name}` },
    { p: `${CONFIG.company} · ${CONFIG.moon} · ${CONFIG.planet} · ${CONFIG.star} · ${CONFIG.sector}` }];
  let zone = null;
  for (const e of roomEntries()) {
    if (e.zone !== zone) { zone = e.zone; blocks.push({ h: 2, text: zone }); }
    blocks.push({ h: 3, text: `${e.code} – ${e.name}` });
    const dash = (v) => (v && String(v).trim() ? v : '–');
    blocks.push({ kv: ['Raum-ID', e.code] });
    blocks.push({ kv: ['Name', e.name] });
    blocks.push({ kv: ['Bereich', e.zone] });
    blocks.push({ kv: ['Ebene', level.name] });
    blocks.push({ kv: ['Status', STATUS[e.d.status || '']] });
    blocks.push({ kv: ['Türen', e.doors] });
    blocks.push({ kv: ['Kameras', String(e.cams)] });
    blocks.push({ kv: ['Piktogramme', e.d.picto?.length ? e.d.picto.map((p) => `${semioticById(p.id)?.name}${p.map ? ' (auf der Karte)' : ''}`).join(', ') : '–'] });
    blocks.push({ kv: ['Notiz (Terminal)', dash(e.d.info)] });
    for (const [k, label] of DESC_FIELDS) blocks.push({ kv: [DESC_LABELS[k] || label, dash(e.d[k])] });
    if (e.d.items?.length) {
      blocks.push({ p: 'Was für Gegenstände findet man:', bold: true });
      blocks.push({ list: e.d.items.map((it) => `${it.qty ? `${it.qty}× ` : ''}${it.name}${it.note ? ` – ${it.note}` : ''}`) });
    } else {
      blocks.push({ kv: ['Was für Gegenstände findet man', '–'] });
    }
  }
  blocks.push({ h: 2, text: 'AUFZÜGE' });
  for (const l of level.lifts) {
    const d = liftData(l, layer);
    blocks.push({ h: 3, text: `Aufzug ${d.letter || (l.id === 'MF' ? '(klein, Administration)' : l.id)}` });
    blocks.push({ kv: ['Sicherheitsstufe', d.sec ? SECURITY[d.sec].label : '–'] });
    blocks.push({ kv: ['Zugang zu', d.access || '–'] });
  }
  return blocks;
}

function exportOdt() {
  download(makeOdt(roomListBlocks()), `${CONFIG.stationCode}-${LV.id}-raumliste.odt`);
}

function exportPdf() {
  const e = (t) => esc(t).replace(/\n/g, '<br>');
  const html = roomListBlocks().map((b) => {
    if (b.h) return `<h${b.h}>${e(b.text)}</h${b.h}>`;
    if (b.kv) return `<p><b>${e(b.kv[0])}:</b> ${e(b.kv[1])}</p>`;
    if (b.list) return `<ul>${b.list.map((t) => `<li>${e(t)}</li>`).join('')}</ul>`;
    return `<p${b.bold ? ' class="b"' : ''}>${e(b.p)}</p>`;
  }).join('');
  const w = open('', '_blank');
  if (!w) { toast('POPUP BLOCKIERT – BITTE POPUPS FÜR DIESE SEITE ERLAUBEN'); return; }
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(CONFIG.stationCode)} Raumliste</title>
    <style>body{font:11pt/1.45 Arial,Helvetica,sans-serif;color:#111;margin:18mm}h1{font-size:20pt;margin:0 0 4mm}h2{font-size:14pt;border-bottom:1px solid #999;margin:8mm 0 3mm;page-break-after:avoid}
    h3{font-size:11.5pt;margin:5mm 0 1.5mm;page-break-after:avoid}p{margin:0 0 1.5mm}ul{margin:0 0 2mm 5mm}.b{font-weight:bold}
    @media print{body{margin:0}}</style></head><body>${html}
    <script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      snapshot();
      layer = importLayer(data.layer || data);
      if (data.equipment) importEquipment(data.equipment);
      if (data.content) { saveContent(data.content); contentEd?.refresh(); }
      st.sel = null;
      commit();
      renderProps();
      toast('KARTE IMPORTIERT');
    } catch {
      toast('DATEI KONNTE NICHT GELESEN WERDEN');
    }
  };
  reader.readAsText(file);
}

// ---------- Start ----------

// ---------- Reiter: Stationsplan und Terminal-Inhalte ----------

let contentEd = null;
function initTabs() {
  const tabs = CONTENT_TABS;
  $('#tabs').innerHTML = tabs.map(([k, t]) => `<button class="ed-tab" data-tab="${k}">${t}</button>`).join('');
  contentEd = createContentEditor($('#content'), {
    level,
    getLayer: () => layer,
    setRoomStatus: (id, status) => { snapshot(); patchRoom(id, { status }); commit(); },
    toast,
  });
  const show = (k) => {
    document.querySelectorAll('.ed-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
    document.body.classList.toggle('tab-content', k !== 'map');
    $('#content').hidden = k === 'map';
    $('#ed-sub').textContent = k === 'map' ? `// ${level.name}` : '// TERMINAL-INHALTE';
    if (k === 'map') { render(); renderProps(); } else contentEd.show(k);
    try { sessionStorage.setItem('apollo.editor.tab', k); } catch { /* egal */ }
  };
  document.querySelectorAll('.ed-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  let start = 'map';
  try { start = sessionStorage.getItem('apollo.editor.tab') || 'map'; } catch { /* egal */ }
  show(tabs.some(([k]) => k === start) ? start : 'map');
}

function init() {
  $('#ed-sub').textContent = `// ${level.name}`;
  $('#tools').innerHTML = TOOLS.map((t) => `<button class="ed-tool" data-tool="${t.id}"><span class="k">${t.key}</span>${t.label}</button>`).join('');
  $('#secs').innerHTML = Object.entries(SECURITY).map(([k, v]) => `<button class="ed-sec" data-sec="${k}"><i style="background:var(--sec-${k})"></i>${v.label}</button>`).join('');
  document.querySelectorAll('.ed-tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.querySelectorAll('#secs .ed-sec').forEach((b) => b.addEventListener('click', () => setSec(b.dataset.sec)));

  $('#pictos').innerHTML = `<div class="ed-head">PIKTOGRAMM</div><div class="ed-palette">${SEMIOTIC.map((sm) => `<button class="ed-pal" data-pick="${sm.id}" title="${sm.id}. ${esc(sm.name)} – ${esc(sm.de)}">${semioticSvg(sm.id, 34)}</button>`).join('')}</div><p class="ed-note" id="pick-name"></p>`;
  const pick = (id) => {
    st.picto = id;
    document.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', Number(b.dataset.pick) === id));
    const sm = semioticById(id);
    $('#pick-name').textContent = `${sm.id}. ${sm.name} – ${sm.de}`;
  };
  document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { pick(Number(b.dataset.pick)); setTool('picto'); }));
  pick(1);
  $('#list-pdf').addEventListener('click', exportPdf);
  $('#list-odt').addEventListener('click', exportOdt);
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#export').addEventListener('click', exportLayer);
  $('#import').addEventListener('click', () => $('#importfile').click());
  $('#importfile').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
  $('#clear').addEventListener('click', () => {
    if (!confirm('Alle Türen, Trennlinien, Kameras und Raumdaten dieser Ebene löschen?')) return;
    snapshot();
    layer = { ...emptyLayer(), settings: layer.settings };
    st.sel = null;
    commit();
    renderProps();
  });
  $('#showcams').addEventListener('change', (e) => { snapshot(); layer.settings.showCams = e.target.checked; commit(); });
  $('#zin').addEventListener('click', () => zoomAt(0.7, st.vb.x + st.vb.w / 2, st.vb.y + st.vb.h / 2));
  $('#zout').addEventListener('click', () => zoomAt(1 / 0.7, st.vb.x + st.vb.w / 2, st.vb.y + st.vb.h / 2));
  $('#zhome').addEventListener('click', homeView);

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointerleave', () => drawUi());
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toMap(e);
    zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  addEventListener('resize', () => setVB({ ...st.vb, h: st.vb.w * (svg.clientHeight / svg.clientWidth) }));

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !equip.hidden) { closeEquip(); return; }
    if (e.key === 'Escape' && !detail.hidden) { closeDetail(); return; }
    if (e.target.closest('input, textarea, select')) return;
    if (!detail.hidden || !equip.hidden) return;
    if (document.body.classList.contains('tab-content')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key === e.key);
    if (t) { setTool(t.id); return; }
    if (k === 'escape') { if (st.lineStart) { st.lineStart = null; drawUi(); } else select(null); return; }
    if ((k === 'delete' || k === 'backspace') && st.sel && st.sel.kind !== 'room') { e.preventDefault(); remove(st.sel.kind, st.sel.id); return; }
    if (k === 'g') setSec('green');
    if (k === 'o') setSec('orange');
    if (k === 'r') setSec('red');
  });

  // Änderungen aus einem anderen Editor-Fenster übernehmen
  addEventListener('storage', (e) => {
    if (e.key === `apollo.map.${LV.id}.v2`) { layer = loadLayer(LV.id, LV.layer); validateSel(); render(); renderProps(); }
  });

  homeView();
  setTool('select');
  setSec('green');
  render();
  renderProps();
  updateButtons();
  initTabs();
}

init();
