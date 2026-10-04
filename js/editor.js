// Karten-Editor: Türen, Trennlinien, Kameras und Raumdaten auf einem Stationsplan eintragen.
import { CONFIG, STATION } from './data.js';
import { el } from './svg.js';
import { drawStationPlan, roomName, frame } from './stationplan.js';
import {
  CAM, SECURITY, STATUS, UNITS_PER_M, loadLayer, saveLayer, emptyLayer, importLayer,
  snapDoor, roomAt, containerRects, camHandle, roomDoors, roomCams,
} from './layer.js';

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
  { id: 'room', key: '5', label: 'RAUM BENENNEN', hint: 'Raum anklicken, rechts Name, Status und Notiz eintragen' },
  { id: 'erase', key: '6', label: 'RADIERER', hint: 'Tür, Linie oder Kamera anklicken zum Löschen' },
];

const st = {
  tool: 'select',
  sec: 'green',
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
  if (st.sel && st.sel.kind !== 'room' && !find(st.sel.kind, st.sel.id)) st.sel = null;
}

const listOf = (kind) => ({ door: layer.doors, line: layer.lines, cam: layer.cams }[kind]);
const find = (kind, id) => listOf(kind)?.find((o) => o.id === id);

function remove(kind, id) {
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
  svg.style.setProperty('--k', (r.w / (svg.clientWidth || 1000)).toFixed(4));
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
  if (sel.kind === 'door') {
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
    const room = level.rooms.find((r) => r.id === sel.id);
    const data = layer.rooms[room.id] || {};
    const doors = roomDoors(layer, room);
    props.innerHTML = `
      <h3>${esc(roomName(level, room, layer))}</h3>
      <div class="ed-row"><span class="dim">ID</span><span>${room.id}</span></div>
      <div class="ed-row"><span class="dim">BEREICH</span><span>${level.zones[room.zone] || room.zone}</span></div>
      <div class="ed-row"><span class="dim">TÜREN</span><span>${doors.length}</span></div>
      <div class="ed-row"><span class="dim">KAMERAS</span><span>${roomCams(layer, room).length}</span></div>
      <label class="ed-field">NAME <input type="text" data-k="name" maxlength="40" value="${esc(data.name)}" placeholder="${esc(roomName(level, room, { rooms: {} }))}"></label>
      <label class="ed-field">STATUS <select data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(data.status || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="ed-field">NOTIZ (ERSCHEINT IM TERMINAL) <textarea data-k="info" maxlength="300">${esc(data.info)}</textarea></label>
      <div class="ed-btns"><button data-reset>RAUMDATEN ZURÜCKSETZEN</button></div>`;
    props.querySelectorAll('[data-k]').forEach((inp) => {
      inp.addEventListener('focus', snapshot);
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        const d = { ...(layer.rooms[room.id] || {}) };
        d[inp.dataset.k] = inp.value.trim() ? inp.value : '';
        if (!d.name && !d.status && !d.info) delete layer.rooms[room.id];
        else layer.rooms[room.id] = d;
        commit();
        props.querySelector('h3').textContent = roomName(level, room, layer);
      });
    });
    props.querySelector('[data-reset]').addEventListener('click', () => {
      snapshot();
      delete layer.rooms[room.id];
      commit();
      renderProps();
    });
  }
  props.querySelector('[data-del]')?.addEventListener('click', () => remove(sel.kind, sel.id));
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
  $('#hint').textContent = TOOLS.find((t) => t.id === id).hint;
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

  if (st.tool === 'select') {
    const obj = objectAt(e);
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
  }
}

function startPan(e, clickSelectsRoom = false) {
  st.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: { ...st.vb }, moved: false, clickSelectsRoom, pt: toMap(e) };
  svg.setPointerCapture(e.pointerId);
}

function onMove(e) {
  const pt = toMap(e);
  $('#coords').textContent = `X ${m(pt.x)} M · Y ${m(pt.y)} M`;
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
  if (d.type === 'move' && st.sel) {
    const obj = find(st.sel.kind, st.sel.id);
    const orig = JSON.parse(d.orig);
    if (!d.moved) {
      if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 4) return;
      d.moved = true;
      snapshot();
    }
    if (st.sel.kind === 'door') {
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
  if (d.type === 'handle' || (d.type === 'move' && d.moved)) {
    commit();
    renderProps();
  }
  try { svg.releasePointerCapture(e.pointerId); } catch { /* egal */ }
}

// ---------- Export / Import ----------

function exportLayer() {
  const blob = new Blob([JSON.stringify({ format: 'apollo-map-layer', level: LV.id, version: 2, layer }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `apollo-${LV.id}-karte.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      snapshot();
      layer = importLayer(data.layer || data);
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

function init() {
  $('#ed-sub').textContent = `// ${CONFIG.stationCode} · ${level.name}`;
  $('#tools').innerHTML = TOOLS.map((t) => `<button class="ed-tool" data-tool="${t.id}"><span class="k">${t.key}</span>${t.label}</button>`).join('');
  $('#secs').innerHTML = Object.entries(SECURITY).map(([k, v]) => `<button class="ed-sec" data-sec="${k}"><i style="background:var(--sec-${k})"></i>${v.label}</button>`).join('');
  document.querySelectorAll('.ed-tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.querySelectorAll('#secs .ed-sec').forEach((b) => b.addEventListener('click', () => setSec(b.dataset.sec)));

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
    if (e.target.closest('input, textarea, select')) return;
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
}

init();
