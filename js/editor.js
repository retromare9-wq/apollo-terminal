// Karten-Editor: Türen, Zonen, Kameras, Schachtzugänge und Raumdaten auf einem Stationsplan eintragen.
import { CONFIG } from './data.js';
import { el } from './svg.js';
import { drawStationPlan, roomName, roomCode, roomZone, liftData, applyZoom, planLabels, roomIdPos, bbox } from './stationplan.js';
import {
  CAM, SECURITY, STATUS, UNITS_PER_M, DESC_FIELDS, MAX_PICTOS, loadLayer, saveLayer, emptyLayer, importLayer,
  snapDoor, roomAt, containerRects, camHandle, roomDoors, roomCams, inRect, corridorAt, storageKey, SHAFT, roomShafts,
} from './layer.js';
import { SEMIOTIC, semioticSvg, semioticById } from './semiotic.js';
import { equipmentList, equipmentCategories, saveItem, deleteItem, exportEquipment, importEquipment } from './equipment.js';
import { makeOdt } from './odt.js';
import { loadContent, currentContent, saveContent } from './content.js';
import { createContentEditor, CONTENT_TABS } from './content-editor.js';
import { loadPlans, savePlans, normPlans, PLANS_KEY, asLevel, emptyPlan, SNAP, MM, LAYER_FALLBACK } from './plans.js';

loadContent();

// Karten mit Ebenen; bearbeitet wird immer eine Ebene (level = Grundriss, layer = Türen, Kameras, Raumdaten)
let plans = loadPlans();
const cur = { mi: 0, li: 0 };
try { Object.assign(cur, JSON.parse(sessionStorage.getItem('apollo.editor.level') || '{}')); } catch { /* egal */ }
let MAP;
let LV;
let level;
let layer;
function bindLevel() {
  if (!plans.maps[cur.mi]) cur.mi = 0;
  MAP = plans.maps[cur.mi];
  if (!MAP.levels[cur.li]) cur.li = 0;
  LV = MAP.levels[cur.li];
  level = asLevel(MAP, LV);
  layer = loadLayer(LV.id, LAYER_FALLBACK[LV.id]);
  try { sessionStorage.setItem('apollo.editor.level', JSON.stringify(cur)); } catch { /* egal */ }
}
bindLevel();

const $ = (s) => document.querySelector(s);
const svg = $('#map');
const props = $('#props');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const snap = (v, s = 25) => Math.round(v / s) * s;
const m = (u) => (u / UNITS_PER_M).toFixed(1);

const TOOLS = [
  // Werkzeug
  { id: 'select', key: '1', group: 'tool', label: 'AUSWAHL', hint: 'Objekt anklicken zum Auswählen und Verschieben · freie Fläche ziehen = Karte bewegen · Raum anklicken = Raumdaten · Strg+Klick oder Strg+Rahmen ziehen = mehrere Objekte wählen' },
  { id: 'erase', key: '2', group: 'tool', label: 'RADIERER', hint: 'Tür, Zone, Kamera, Schachtzugang oder Beschriftung anklicken zum Löschen' },
  { id: 'label', key: '3', group: 'tool', label: 'BESCHRIFTUNG', hint: 'Klicken, um eine neue Beschriftung zu setzen · vorhandene Beschriftungen mit dem Auswahl-Werkzeug anklicken, ändern und verschieben' },
  { id: 'picto', key: '4', group: 'tool', label: 'PIKTOGRAMM', hint: 'Piktogramm links auswählen, dann in einen Raum klicken (höchstens 5 pro Raum)' },
  // Items
  { id: 'door', key: '5', group: 'items', label: 'TÜR', hint: 'In einen Gang klicken (Tür quer zum Gang) oder an eine Raumwand (Tür in der Wand). Stufe links wählen.' },
  { id: 'plift', key: '6', group: 'items', label: 'AUFZUG', hint: 'Klicken setzt einen Aufzug (Kabine + Leitergang) · anklicken, um ihn zu drehen, zu verschieben oder Ebenen zuzuordnen' },
  { id: 'cam', key: '7', group: 'items', label: 'KAMERA', hint: 'In einen Raum oder Gang klicken · gelben Punkt ziehen = Richtung und Reichweite' },
  { id: 'shaft', key: '8', group: 'items', label: 'SCHACHTZUGANG', hint: 'Klicken setzt einen Schachtzugang (2 × 2 mm) · anklicken: Schacht-ID und Notiz' },
  // Grundriss
  { id: 'proom', key: 'q', group: 'plan', label: 'RAUM ZEICHNEN', hint: 'Rechteck aufziehen · Größe in 5-mm-Schritten (2,5 m), mit gedrückter Strg-Taste in 1-mm-Schritten (1 Kästchen = 1 mm = 0,5 m) · im Raum-Fenster „+ TEILFLÄCHE“ baut an einen Raum an' },
  { id: 'cnarrow', key: 'w', group: 'plan', label: 'KORRIDOR SCHMAL', hint: 'Strecke ziehen – Breite fest (schmal), Länge in 5-mm-Schritten · mit Strg frei in 1-mm-Schritten · Breiten im Kartenfenster einstellbar (Esc = nichts gewählt)' },
  { id: 'cwide', key: 'e', group: 'plan', label: 'KORRIDOR BREIT', hint: 'Strecke ziehen – Breite fest (breit), Länge in 5-mm-Schritten · mit Strg frei in 1-mm-Schritten' },
  { id: 'line', key: 'a', group: 'plan', label: 'ZONEN', hint: 'Zonen markieren: LINIE = Anfangs- und Endpunkt klicken (rastet auf jeden Millimeter ein, Esc bricht ab) · KASTEN = aufziehen wie ein Raum (5-mm-Schritte, mit Strg 1 mm)' },
];
const TOOL_GROUPS = [['tool', 'WERKZEUG'], ['items', 'ITEMS'], ['plan', 'GRUNDRISS']];
const snapP = (pt) => ({ x: snap(pt.x, SNAP), y: snap(pt.y, SNAP) });

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
  multi: [],          // Mehrfachauswahl (Strg+Klick / Strg+Rahmen)
};

// ---------- Verlauf und Speichern ----------

const stateJson = () => JSON.stringify({ layer, plan: LV.plan });
function restore(json) {
  const d = JSON.parse(json);
  layer = d.layer;
  LV.plan = d.plan;
  level = asLevel(MAP, LV);
}
function snapshot() {
  st.undo.push(stateJson());
  if (st.undo.length > 100) st.undo.shift();
  st.redo = [];
  updateButtons();
}
function commit() {
  const ok1 = saveLayer(LV.id, layer);
  level = asLevel(MAP, LV);
  const ok2 = savePlans(plans);
  if (!ok1 || !ok2) toast('ACHTUNG: SPEICHERN IM BROWSER FEHLGESCHLAGEN – BITTE SOFORT EXPORTIEREN');
  render();
}
function undo() {
  if (!st.undo.length) return;
  st.redo.push(stateJson());
  restore(st.undo.pop());
  validateSel();
  commit();
  renderProps();
  updateButtons();
}
function redo() {
  if (!st.redo.length) return;
  st.undo.push(stateJson());
  restore(st.redo.pop());
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
  st.multi = [];
  const s0 = st.sel;
  if (!s0) return;
  if (s0.kind === 'room' && !roomById(s0.id)) st.sel = null;
  else if (s0.kind === 'lift' && !level.lifts.some((l) => l.id === s0.id)) st.sel = null;
  else if (s0.kind === 'corr' && !level.corridors[s0.id]) st.sel = null;
  else if (!['room', 'lift', 'corr'].includes(s0.kind) && !find(s0.kind, s0.id)) st.sel = null;
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

const listOf = (kind) => ({ door: layer.doors, line: layer.lines, cam: layer.cams, shaft: layer.shafts }[kind]);
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
  drawGrid(el('g', { class: 'mm' }, svg));
  const g = el('g', {}, svg);
  const info = drawStationPlan(g, CONFIG, level, layer, { cams: true, editor: true });
  ui = el('g', {}, svg);
  drawHandles();
  // Auswahl markieren
  st.multi.forEach((it) => {
    if (it.kind === 'room') info.plan.nodes[it.id]?.classList.add('sel');
    else if (it.kind === 'corr') (info.plan.corrNodes[it.id] || []).forEach((n) => n.classList.add('ed-sel'));
    else if (it.kind === 'lift') svg.querySelector(`[data-lift="${it.id}"]`)?.classList.add('ed-sel');
    else info.plan.objects[it.id]?.classList.add('ed-sel');
  });
  if (st.sel?.kind === 'corr') (info.plan.corrNodes[st.sel.id] || []).forEach((n) => n.classList.add('ed-sel'));
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

// Millimeterpapier: feine Linie je mm, kräftiger je 5 mm und je cm
function drawGrid(g) {
  const defs = el('defs', {}, g);
  const pat = el('pattern', { id: 'mmgrid', width: MM * 10, height: MM * 10, patternUnits: 'userSpaceOnUse' }, defs);
  for (let i = 0; i < 10; i++) {
    const cls = i === 0 ? 'mm-major' : i === 5 ? 'mm-mid' : 'mm-minor';
    el('line', { x1: i * MM, y1: 0, x2: i * MM, y2: MM * 10, class: cls }, pat);
    el('line', { x1: 0, y1: i * MM, x2: MM * 10, y2: i * MM, class: cls }, pat);
  }
  const b = level.bounds;
  const pad = 3000;
  const x0 = Math.floor((b[0] - pad) / 100) * 100;
  const y0 = Math.floor((b[1] - pad) / 100) * 100;
  el('rect', { x: x0, y: y0, width: b[2] - x0 + pad, height: b[3] - y0 + pad, fill: 'url(#mmgrid)' }, g);
}

// Anfasser zum Ändern der Größe (Raum-Teilflächen, Korridor)
const CORNERS = [[0, 1], [2, 1], [2, 3], [0, 3]];
function drawHandles() {
  const sel = st.sel;
  if (!sel || st.tool !== 'select') return;
  const r = 6 * (st.vb ? Math.max(0.6, st.vb.w / (svg.clientWidth || 1000)) : 1);
  const put = (rect, tag) => CORNERS.forEach(([cx, cy], k) => el('rect', { x: rect[cx] - r, y: rect[cy] - r, width: r * 2, height: r * 2, class: 'ed-handle', 'data-phandle': `${tag}:${k}` }, ui));
  if (sel.kind === 'room') roomById(sel.id)?.rects.forEach((rc, i) => put(rc, `room:${i}`));
  if (sel.kind === 'corr' && level.corridors[sel.id]) put(level.corridors[sel.id], 'corr:0');
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
  } else if (st.drag?.type === 'ctrlsel' && st.drag.moved) {
    const r = norm4(st.drag.start, pt);
    el('rect', { x: r[0], y: r[1], width: r[2] - r[0], height: r[3] - r[1], class: 'ed-marquee' }, uiTemp);
  } else if (st.drag?.type === 'draw') {
    const rc = drawRect(st.drag, pt);
    if (rc) el('rect', { x: rc[0], y: rc[1], width: rc[2] - rc[0], height: rc[3] - rc[1], class: 'ed-draw' }, uiTemp);
  } else if (['proom', 'cnarrow', 'cwide', 'plift'].includes(st.tool)) {
    const p = snapP(pt);
    if (st.tool === 'plift') el('rect', { x: p.x, y: p.y, width: 100, height: 50, class: 'ed-draw' }, uiTemp);
    else el('circle', { cx: p.x, cy: p.y, r: 4, class: 'ed-snapdot' }, uiTemp);
  } else if (st.tool === 'shaft') {
    const p = snapP({ x: pt.x - SHAFT / 2, y: pt.y - SHAFT / 2 });
    el('rect', { x: p.x, y: p.y, width: SHAFT, height: SHAFT, class: 'ed-draw' }, uiTemp);
  } else if (st.tool === 'line' && st.zoneMode === 'box') {
    const p = snapP(pt);
    el('circle', { cx: p.x, cy: p.y, r: 4, class: 'ed-snapdot' }, uiTemp);
  } else if (st.tool === 'line') {
    const p = { x: snap(pt.x, MM), y: snap(pt.y, MM) };
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
  if (st.multi.length > 1) {
    const names = { room: 'RÄUME', corr: 'KORRIDORE', lift: 'AUFZÜGE', door: 'TÜREN', cam: 'KAMERAS', line: 'ZONEN', label: 'BESCHRIFTUNGEN', shaft: 'SCHACHTZUGÄNGE' };
    const count = {};
    st.multi.forEach((it) => { count[it.kind] = (count[it.kind] || 0) + 1; });
    props.innerHTML = `
      <h3>${st.multi.length} OBJEKTE AUSGEWÄHLT</h3>
      ${Object.entries(count).map(([k, n]) => `<div class="ed-row"><span class="dim">${names[k] || k}</span><span>${n}</span></div>`).join('')}
      <div class="ed-btns"><button data-mcopy>KOPIEREN (STRG+C)</button><button class="danger" data-mdel>LÖSCHEN</button></div>
      <p class="ed-note">Strg+Klick fügt Objekte hinzu oder nimmt sie heraus · mit gedrückter Strg-Taste einen Rahmen ziehen wählt alles, was ganz darin liegt · ein gewähltes Objekt ziehen verschiebt die ganze Gruppe (Türen und Kameras der Räume wandern mit) · Strg+V fügt die Kopie an der Mausposition ein · Esc hebt die Auswahl auf.</p>`;
    props.querySelector('[data-mcopy]').addEventListener('click', copySel);
    props.querySelector('[data-mdel]').addEventListener('click', deleteMulti);
    return;
  }
  const sel = st.sel;
  if (!sel) {
    const t = TOOLS.find((x) => x.id === st.tool);
    props.innerHTML = `
      <h3>KARTE</h3>
      <label class="ed-field">NAME DER KARTE <input type="text" data-map="name" maxlength="40" value="${esc(MAP.name)}"></label>
      <label class="ed-check ed-big"><input type="checkbox" data-map="terminal" ${MAP.terminal ? 'checked' : ''}> IM TERMINAL ANZEIGEN</label>
      <div class="ed-crow">
        <label class="ed-field">KORRIDOR SCHMAL (M) <input type="text" data-mapw="narrow" value="${m(MAP.narrow)}"></label>
        <label class="ed-field">KORRIDOR BREIT (M) <input type="text" data-mapw="wide" value="${m(MAP.wide)}"></label>
      </div>
      <div class="ed-btns"><button data-act="map-new">+ NEUE KARTE</button><button data-act="map-copy">KOPIEREN</button><button class="danger" data-act="map-del" ${plans.maps.length < 2 ? 'disabled' : ''}>LÖSCHEN</button></div>
      <h3 class="ed-h3">EBENE</h3>
      <label class="ed-field">NAME DER EBENE <input type="text" data-lvl="name" maxlength="40" value="${esc(level.name)}"></label>
      <div class="ed-btns"><button data-act="lvl-new">+ NEUE EBENE</button><button data-act="lvl-up" ${cur.li === 0 ? 'disabled' : ''}>↑</button><button data-act="lvl-down" ${cur.li >= MAP.levels.length - 1 ? 'disabled' : ''}>↓</button><button class="danger" data-act="lvl-del" ${MAP.levels.length < 2 ? 'disabled' : ''}>LÖSCHEN</button></div>
      <div class="ed-row"><span class="dim">RÄUME</span><span>${level.rooms.length}</span></div>
      <div class="ed-row"><span class="dim">KORRIDORE</span><span>${level.corridors.length}</span></div>
      <div class="ed-row"><span class="dim">AUFZÜGE</span><span>${level.lifts.length}</span></div>
      <div class="ed-row"><span class="dim">TÜREN · KAMERAS</span><span>${layer.doors.length} · ${layer.cams.length}</span></div>
      <p class="ed-note"><b>Raster:</b> 1 Kästchen = 1 mm = 0,5 m · dicke Linie = 1 cm = 5 m. Im Terminal wechselt Strg + „+“ / Strg + „−“ die Ebene; Reihenfolge wie hier (↑ ↓).</p>
      <p class="ed-note">${esc(t.hint)}</p>
      <p class="ed-note"><b>Sicherheitsstufen</b><br>
        <span class="sec-t sec-green">GRÜN</span> – offen für alle<br>
        <span class="sec-t sec-orange">ORANGE</span> – Karte nötig, kein Zugang zu lebenswichtiger Infrastruktur und Mainframe<br>
        <span class="sec-t sec-red">ROT</span> – Vollzugriff</p>`;
    bindMapProps();
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
      <h3>ZONE – ${l.box ? 'KASTEN' : 'LINIE'}</h3>
      ${l.box ? `<div class="ed-row"><span class="dim">GRÖSSE</span><span>${m(Math.abs(l.x2 - l.x1))} × ${m(Math.abs(l.y2 - l.y1))} M</span></div>`
        : `<div class="ed-row"><span class="dim">LÄNGE</span><span>${m(Math.hypot(l.x2 - l.x1, l.y2 - l.y1))} M</span></div>`}
      <div class="ed-btns"><button class="danger" data-del>ZONE LÖSCHEN</button></div>
      <p class="ed-note">Mit dem Auswahl-Werkzeug ziehen, um die Zone zu verschieben (rastet auf jeden Millimeter ein).</p>`;
  } else if (sel.kind === 'shaft') {
    const sh = find('shaft', sel.id);
    const room = roomAt(level, sh.x + SHAFT / 2, sh.y + SHAFT / 2);
    const def = room ? roomCode(room, layer) : '';
    props.innerHTML = `
      <h3>SCHACHTZUGANG</h3>
      <div class="ed-row"><span class="dim">RAUM</span><span>${room ? esc(roomName(level, room, layer)) : '– (AUSSERHALB) –'}</span></div>
      <label class="ed-field">SCHACHT-ID <input type="text" data-sk="sid" maxlength="30" value="${esc(sh.sid)}" placeholder="${esc(def || 'SCHACHT')}"></label>
      <label class="ed-check ed-big"><input type="checkbox" data-shvis ${sh.hidden ? '' : 'checked'}> AUF DER TERMINAL-KARTE ANZEIGEN</label>
      <label class="ed-field">NOTIZ <textarea data-sk="note" maxlength="1000">${esc(sh.note)}</textarea></label>
      <div class="ed-btns"><button class="danger" data-del>SCHACHTZUGANG LÖSCHEN</button></div>
      <p class="ed-note">Ohne eigene Schacht-ID gilt die ID des Raums. Ausgeblendete Zugänge erscheinen im Editor blass gestrichelt. Mit dem Auswahl-Werkzeug ziehen = verschieben.</p>`;
    props.querySelector('[data-shvis]').addEventListener('change', (e) => {
      snapshot();
      if (e.target.checked) delete sh.hidden; else sh.hidden = true;
      commit();
    });
    props.querySelectorAll('[data-sk]').forEach((inp) => {
      inp.addEventListener('focus', snapshot);
      inp.addEventListener('input', () => { if (inp.value.trim()) sh[inp.dataset.sk] = inp.value; else delete sh[inp.dataset.sk]; commit(); });
    });
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
      <label class="ed-check ed-big"><input type="checkbox" data-kb="cluttered" ${data.cluttered ? 'checked' : ''}> CLUTTERED</label>
      <label class="ed-field">STATUS <select data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${(data.status || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="ed-field">NOTIZ (ERSCHEINT IM TERMINAL) <textarea data-k="info" maxlength="300">${esc(data.info)}</textarea></label>
      <div class="ed-field">PIKTOGRAMME (${pics.length}/${MAX_PICTOS})</div>
      <div class="ed-pics">${pics.map((p) => `<span class="ed-pic ${p.map ? 'on-map' : ''}" title="${esc(semioticById(p.id)?.name)}${p.map ? ' · auf der Karte' : ''}">${semioticSvg(p.id, 34)}</span>`).join('') || '<span class="dim">KEINE</span>'}</div>
      <div class="ed-btns"><button data-detail>RAUMBESCHREIBUNG ÖFFNEN ▸</button><button data-reset>ZURÜCKSETZEN</button></div>
      <h3 class="ed-h3">GRUNDRISS</h3>
      ${colorRows(room.fill, room.stroke, DEF.room)}
      <div class="ed-btns"><button data-allcol="room">FARBEN FÜR ALLE RÄUME DER EBENE</button></div>
      <div class="ed-field">TEILFLÄCHEN</div>
      ${room.rects.map((r, i) => `<div class="ed-row"><span>TEIL ${i + 1}: ${m(r[2] - r[0])} × ${m(r[3] - r[1])} M</span>${room.rects.length > 1 ? `<button class="danger ed-mini" data-partdel="${i}">✕</button>` : ''}</div>`).join('')}
      <div class="ed-btns"><button data-append>${st.append === room.id ? 'JETZT RECHTECK AUFZIEHEN …' : '+ TEILFLÄCHE ANBAUEN'}</button><button class="danger" data-pdel>RAUM LÖSCHEN</button></div>
      <p class="ed-note">Gewählten Raum ziehen = verschieben (Türen, Kameras und Raum-ID wandern mit) · gelbe Ecken ziehen = Größe ändern in 5-mm-Schritten, mit Strg in 1-mm-Schritten · Strg+C / Strg+V kopiert.</p>`;
    bindRoomFields(props, room);
    bindColors(room, 'room');
    props.querySelector('[data-append]').addEventListener('click', () => { st.append = room.id; setTool('proom'); renderProps(); });
    props.querySelector('[data-pdel]').addEventListener('click', () => deletePlanItem(sel));
    props.querySelectorAll('[data-partdel]').forEach((b) => b.addEventListener('click', () => {
      snapshot();
      room.rects.splice(Number(b.dataset.partdel), 1);
      commit();
      renderProps();
    }));
    props.querySelector('[data-detail]').addEventListener('click', () => openDetail(room.id));
    props.querySelector('[data-reset]').addEventListener('click', () => {
      if (!confirm('Alle Angaben zu diesem Raum löschen?')) return;
      snapshot();
      delete layer.rooms[room.id];
      commit();
      renderProps();
    });
  } else if (sel.kind === 'corr') {
    const c = level.corridors[sel.id];
    const st0 = c[4] || {};
    props.innerHTML = `
      <h3>KORRIDOR</h3>
      <div class="ed-row"><span class="dim">MASSE</span><span>${m(c[2] - c[0])} × ${m(c[3] - c[1])} M</span></div>
      ${colorRows(st0.fill, st0.stroke, DEF.corr)}
      <div class="ed-btns"><button data-allcol="corr">FARBEN FÜR ALLE KORRIDORE DER EBENE</button></div>
      <div class="ed-btns"><button class="danger" data-pdel>KORRIDOR LÖSCHEN</button></div>
      <p class="ed-note">Gewählten Korridor ziehen = verschieben · gelbe Ecken ziehen = Länge ändern (mit Strg auch die Breite, in mm-Schritten). Wo Korridor- und Raumrahmen aufeinanderliegen, ist der Raumrahmen zu sehen.</p>`;
    bindColors(c, 'corr');
    props.querySelector('[data-pdel]').addEventListener('click', () => deletePlanItem(sel));
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
      <div class="ed-field">ZUGANG ZU EBENEN DIESER KARTE</div>
      ${MAP.levels.length > 1 ? MAP.levels.map((lv) => `<label class="ed-check"><input type="checkbox" data-liftlvl="${esc(lv.id)}" ${lv.id === LV.id ? 'checked disabled' : (data.levels || []).includes(lv.id) ? 'checked' : ''}> ${esc(lv.plan.name)}${lv.id === LV.id ? ' (HIER)' : ''}</label>`).join('') : '<p class="ed-note">Diese Karte hat nur eine Ebene. Weitere Ebenen legst du im Kartenfenster an (Esc, dann „+ NEUE EBENE“).</p>'}
      <label class="ed-field">HINWEIS IM TERMINAL <textarea data-k="access" maxlength="400" placeholder="z. B. APOLLO MAINFRAME">${esc(data.access)}</textarea></label>
      <div class="ed-btns"><button data-rot>↻ DREHEN</button><button class="danger" data-pdel>AUFZUG LÖSCHEN</button></div>
      <p class="ed-note">Gewählten Aufzug ziehen = verschieben.</p>`;
    props.querySelectorAll('[data-liftlvl]').forEach((cb) => cb.addEventListener('change', () => {
      snapshot();
      const set = new Set(liftData(lift, layer).levels || []);
      if (cb.checked) set.add(cb.dataset.liftlvl); else set.delete(cb.dataset.liftlvl);
      patchLift(lift.id, { levels: [...set] });
      commit();
    }));
    props.querySelector('[data-rot]').addEventListener('click', () => { snapshot(); rotateLift(lift); commit(); });
    props.querySelector('[data-pdel]').addEventListener('click', () => deletePlanItem(sel));
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

// ---------- Farben und Kartenverwaltung ----------

const DEF = { room: { fill: '#3a2410', stroke: '#d4702c' }, corr: { fill: '#7a2418', stroke: '#a8361f' } };

function colorRows(fill, stroke, def) {
  const row = (k, label, v) => `<div class="ed-crow ed-colrow"><span class="ed-cname">${label}</span><input type="color" data-col="${k}" value="${v || def[k]}"><button class="ed-mini" data-coldef="${k}" ${v ? '' : 'disabled'}>STANDARD</button></div>`;
  return row('fill', 'FLÄCHE', fill) + row('stroke', 'RAHMEN', stroke);
}

// obj: Raum (Farben als Eigenschaften) oder Korridor (Array, Farben im 5. Eintrag)
function bindColors(obj, kind) {
  const get = () => (kind === 'room' ? obj : (obj[4] = obj[4] || {}));
  const set = (k, v) => {
    const t = get();
    if (v) t[k] = v; else delete t[k];
    if (kind === 'corr' && !Object.keys(obj[4]).length) obj.length = 4;
  };
  props.querySelectorAll('[data-col]').forEach((inp) => {
    inp.addEventListener('focus', snapshot, { once: true });
    inp.addEventListener('pointerdown', snapshot, { once: true });
    inp.addEventListener('input', () => { set(inp.dataset.col, inp.value); commit(); });
    inp.addEventListener('change', () => renderProps());
  });
  props.querySelectorAll('[data-coldef]').forEach((b) => b.addEventListener('click', () => { snapshot(); set(b.dataset.coldef, ''); commit(); renderProps(); }));
  props.querySelector('[data-allcol]')?.addEventListener('click', () => {
    const src = kind === 'room' ? { fill: obj.fill, stroke: obj.stroke } : { ...(obj[4] || {}) };
    if (!confirm(kind === 'room' ? 'Diese Farben für alle Räume der Ebene übernehmen?' : 'Diese Farben für alle Korridore der Ebene übernehmen?')) return;
    snapshot();
    if (kind === 'room') level.rooms.forEach((r) => { ['fill', 'stroke'].forEach((k) => { if (src[k]) r[k] = src[k]; else delete r[k]; }); });
    else level.corridors.forEach((c, i) => { level.corridors[i] = Object.keys(src).length ? [...c.slice(0, 4), { ...src }] : c.slice(0, 4); });
    commit();
    renderProps();
  });
}

function switchLevel(mi, li) {
  cur.mi = mi;
  cur.li = li;
  bindLevel();
  st.sel = null;
  st.multi = [];
  st.append = null;
  st.undo = [];
  st.redo = [];
  updateButtons();
  homeView();
  render();
  renderProps();
  renderLevelPick();
}

function renderLevelPick() {
  $('#levelpick').innerHTML = `<div class="ed-head">KARTE / EBENE</div>
    <select id="lvl-sel" class="ed-lvlsel">${plans.maps.map((mp, i) => `<optgroup label="${esc(mp.name)}${mp.terminal ? '' : ' (NUR EDITOR)'}">${mp.levels.map((lv, j) => `<option value="${i}:${j}" ${i === cur.mi && j === cur.li ? 'selected' : ''}>${esc(lv.plan.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  $('#lvl-sel').addEventListener('change', (e) => { const [a, b] = e.target.value.split(':').map(Number); switchLevel(a, b); });
  $('#ed-sub').textContent = `// ${MAP.name} · ${level.name}`;
}

const plansChanged = () => { if (!savePlans(plans)) toast('ACHTUNG: SPEICHERN IM BROWSER FEHLGESCHLAGEN – BITTE SOFORT EXPORTIEREN'); renderLevelPick(); };

function copyLayer(fromId, toId) {
  saveLayer(toId, JSON.parse(JSON.stringify(loadLayer(fromId, LAYER_FALLBACK[fromId]))));
}

function bindMapProps() {
  props.querySelector('[data-map="name"]').addEventListener('input', (e) => { MAP.name = e.target.value.toUpperCase() || 'KARTE'; plansChanged(); });
  props.querySelector('[data-map="terminal"]').addEventListener('change', (e) => { MAP.terminal = e.target.checked; plansChanged(); });
  props.querySelectorAll('[data-mapw]').forEach((inp) => inp.addEventListener('change', () => {
    const v = Number(String(inp.value).replace(',', '.'));
    if (v > 0) MAP[inp.dataset.mapw] = Math.round(v * UNITS_PER_M);
    plansChanged();
    renderProps();
  }));
  props.querySelector('[data-lvl="name"]').addEventListener('input', (e) => { LV.plan.name = e.target.value.toUpperCase() || 'EBENE'; level = asLevel(MAP, LV); plansChanged(); render(); });
  const act = (k, fn) => props.querySelector(`[data-act="${k}"]`)?.addEventListener('click', fn);
  act('map-new', () => {
    const name = prompt('Name der neuen Karte:', 'NEUE KARTE');
    if (!name) return;
    plans.maps.push({ id: uid('m'), name: name.toUpperCase(), terminal: false, narrow: MAP.narrow, wide: MAP.wide, levels: [{ id: uid('l'), plan: emptyPlan('LEVEL 0') }] });
    plansChanged();
    switchLevel(plans.maps.length - 1, 0);
  });
  act('map-copy', () => {
    const copy = JSON.parse(JSON.stringify(MAP));
    copy.id = uid('m');
    copy.name = `${MAP.name} (KOPIE)`;
    copy.terminal = false;
    copy.levels.forEach((lv, i) => { const old = MAP.levels[i].id; lv.id = uid('l'); copyLayer(old, lv.id); });
    plans.maps.push(copy);
    plansChanged();
    switchLevel(plans.maps.length - 1, 0);
    toast('KARTE KOPIERT – NUR IM EDITOR, BIS DU „IM TERMINAL ANZEIGEN“ SETZT');
  });
  act('map-del', () => {
    if (!confirm(`Karte „${MAP.name}“ mit allen Ebenen löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    MAP.levels.forEach((lv) => { try { localStorage.removeItem(storageKey(lv.id)); } catch { /* egal */ } });
    plans.maps.splice(cur.mi, 1);
    plansChanged();
    switchLevel(0, 0);
  });
  act('lvl-new', () => {
    const name = prompt('Name der neuen Ebene:', `LEVEL -${MAP.levels.length}`);
    if (!name) return;
    MAP.levels.push({ id: uid('l'), plan: emptyPlan(name.toUpperCase()) });
    plansChanged();
    switchLevel(cur.mi, MAP.levels.length - 1);
  });
  const move = (dir) => {
    const j = cur.li + dir;
    [MAP.levels[cur.li], MAP.levels[j]] = [MAP.levels[j], MAP.levels[cur.li]];
    plansChanged();
    switchLevel(cur.mi, j);
  };
  act('lvl-up', () => move(-1));
  act('lvl-down', () => move(1));
  act('lvl-del', () => {
    if (!confirm(`Ebene „${level.name}“ löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    try { localStorage.removeItem(storageKey(LV.id)); } catch { /* egal */ }
    MAP.levels.splice(cur.li, 1);
    plansChanged();
    switchLevel(cur.mi, 0);
  });
}

function bindRoomFields(root, room) {
  root.querySelectorAll('[data-kb]').forEach((cb) => cb.addEventListener('change', () => {
    snapshot();
    patchRoom(room.id, { [cb.dataset.kb]: cb.checked || '' });
    commit();
  }));
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
  st.multi = [];
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
  $('#zonemode').hidden = id !== 'line';
  setZoneMode(st.zoneMode || 'line');
  if (id !== 'proom') st.append = null;
  if (ui) render();
  drawUi();
  if (!st.sel) renderProps();
}

function setZoneMode(m) {
  st.zoneMode = m;
  st.lineStart = null;
  document.querySelectorAll('[data-zm]').forEach((b) => b.classList.toggle('on', b.dataset.zm === m));
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

  const ph = e.target.closest?.('[data-phandle]');
  if (ph && st.sel) { startResize(e, ph.dataset.phandle); return; }

  if (st.tool === 'proom' || st.tool === 'cnarrow' || st.tool === 'cwide') {
    st.drag = { type: 'draw', kind: st.tool === 'proom' ? 'room' : st.tool, start: snapP(pt) };
    svg.setPointerCapture(e.pointerId);
    return;
  }
  if (st.tool === 'plift') { placeLift(pt); return; }

  const handle = e.target.closest?.('[data-handle]');
  if (handle) {
    snapshot();
    st.drag = { type: 'handle', id: handle.dataset.handle };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  const liftEl = e.target.closest?.('[data-lift]');
  if (liftEl && (st.tool === 'select' || st.tool === 'room') && !(st.tool === 'select' && (e.ctrlKey || e.metaKey || st.multi.length > 1))) {
    const id = liftEl.dataset.lift;
    if (st.tool === 'select' && st.sel?.kind === 'lift' && st.sel.id === id) { startPlanMove(e, pt, st.sel); return; }
    select({ kind: 'lift', id });
    return;
  }

  if (st.tool === 'select' && (e.ctrlKey || e.metaKey)) {
    // Strg: Klick = Objekt zur Auswahl hinzufügen/entfernen, Ziehen = Auswahlrahmen
    st.drag = { type: 'ctrlsel', start: pt, sx: e.clientX, sy: e.clientY, hit: itemAt(e, pt), moved: false };
    svg.setPointerCapture(e.pointerId);
    return;
  }
  if (st.tool === 'select' && st.multi.length > 1) {
    const hit = itemAt(e, pt);
    if (hit && inMulti(hit)) { startGroupMove(e, pt); return; }
  }
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
    // Gewählten Raum bzw. Korridor ziehen = verschieben
    const at = planAt(pt);
    if (at && st.sel && at.kind === st.sel.kind && at.id === st.sel.id && (at.kind === 'room' || at.kind === 'corr')) {
      startPlanMove(e, pt, st.sel);
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
  if (st.tool === 'line' && st.zoneMode === 'box') {
    st.drag = { type: 'draw', kind: 'zone', start: snapP(pt) };
    svg.setPointerCapture(e.pointerId);
    return;
  }
  if (st.tool === 'shaft') {
    const p = snapP({ x: pt.x - SHAFT / 2, y: pt.y - SHAFT / 2 });
    snapshot();
    const sh = { id: uid('s'), x: p.x, y: p.y };
    layer.shafts.push(sh);
    st.sel = { kind: 'shaft', id: sh.id };
    commit();
    renderProps();
    return;
  }
  if (st.tool === 'line') {
    const p = { x: snap(pt.x, MM), y: snap(pt.y, MM) };
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
          <label class="ed-check ed-big"><input type="checkbox" data-kb="cluttered" ${data.cluttered ? 'checked' : ''}> CLUTTERED</label>
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

// ---------- Grundriss bearbeiten ----------

const norm4 = (a, b) => [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];

// Rechteck beim Aufziehen: Raum frei, Korridor mit fester Breite entlang der Hauptrichtung
// Größe in Schritten: ohne Strg 5 mm (2,5 m), mit Strg 1 mm (0,5 m)
const STEP = MM * 5;
const stepOf = () => (st.ctrl ? MM : STEP);
const stepLen = (v, step) => Math.sign(v || 1) * Math.max(step, Math.round(Math.abs(v) / step) * step);

// Rechteck beim Aufziehen: Raum frei, Korridor mit fester Breite entlang der Hauptrichtung (mit Strg frei)
function drawRect(d, pt) {
  const a = d.start;
  const dx = pt.x - a.x;
  const dy = pt.y - a.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < MM / 2) return null;
  const step = stepOf();
  if (d.kind === 'room' || d.kind === 'zone' || st.ctrl) {
    return norm4(a, { x: a.x + stepLen(dx, step), y: a.y + stepLen(dy, step) });
  }
  const w = d.kind === 'cwide' ? MAP.wide : MAP.narrow;
  if (Math.abs(dx) >= Math.abs(dy)) return norm4(a, { x: a.x + stepLen(dx, step), y: a.y + w });
  return norm4(a, { x: a.x + w, y: a.y + stepLen(dy, step) });
}

function nextRoomId() {
  let n = level.rooms.length + 1;
  while (level.rooms.some((r) => r.id === `R-${n}`)) n++;
  return `R-${n}`;
}

function finishDraw(d, pt) {
  const rc = drawRect(d, pt);
  if (!rc) return;
  snapshot();
  if (d.kind === 'room') {
    const target = st.append && roomById(st.append);
    if (target) {
      target.rects.push(rc);
      st.sel = { kind: 'room', id: target.id };
    } else {
      const room = { id: nextRoomId(), zone: '', label: '', rects: [rc], lines: [] };
      level.rooms.push(room);
      st.sel = { kind: 'room', id: room.id };
    }
    st.append = null;
  } else if (d.kind === 'zone') {
    const z = { id: uid('l'), box: true, x1: rc[0], y1: rc[1], x2: rc[2], y2: rc[3] };
    layer.lines.push(z);
    st.sel = { kind: 'line', id: z.id };
  } else {
    level.corridors.push(rc);
    st.sel = { kind: 'corr', id: level.corridors.length - 1 };
  }
  commit();
  renderProps();
}

function placeLift(pt) {
  const p = snapP(pt);
  const used = new Set(level.lifts.map((l) => l.id));
  const id = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !used.has(c)) || `L${level.lifts.length + 1}`;
  snapshot();
  level.lifts.push({ id, rect: [p.x, p.y, p.x + 100, p.y + 50], dark: 'dl' });
  st.sel = { kind: 'lift', id };
  commit();
  renderProps();
}

function rotateLift(l) {
  const [x0, y0, x1, y1] = l.rect;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const w = y1 - y0;
  const h = x1 - x0;
  l.rect = [snap(cx - w / 2, SNAP), snap(cy - h / 2, SNAP), snap(cx - w / 2, SNAP) + w, snap(cy - h / 2, SNAP) + h];
  const order = ['dl', 'dt', 'dr', 'db'];
  l.dark = order[(order.indexOf(l.dark) + 1) % 4];
}

function deletePlanItem(sel) {
  if (sel.kind === 'room') {
    const room = roomById(sel.id);
    if (!room || !confirm(`Raum ${roomCode(room, layer)} mit allen Angaben löschen?`)) return;
    snapshot();
    level.rooms = level.rooms.filter((r) => r !== room);
    LV.plan.rooms = level.rooms;
    delete layer.rooms[room.id];
  } else if (sel.kind === 'corr') {
    snapshot();
    level.corridors.splice(sel.id, 1);
  } else if (sel.kind === 'lift') {
    snapshot();
    level.lifts = level.lifts.filter((l) => l.id !== sel.id);
    LV.plan.lifts = level.lifts;
    delete layer.lifts[sel.id];
  }
  st.sel = null;
  commit();
  renderProps();
}

// Element am Punkt: Raum vor Korridor
function planAt(pt) {
  const room = roomAt(level, pt.x, pt.y);
  if (room) return { kind: 'room', id: room.id };
  const c = corridorAt(level, pt.x, pt.y);
  if (c) return { kind: 'corr', id: level.corridors.indexOf(c) };
  return null;
}

// Verschieben: Raum (mit Türen, Kameras und Raum-ID), Korridor, Aufzug
function startPlanMove(e, pt, sel) {
  const d = { type: 'pmove', sel, start: pt, moved: false };
  if (sel.kind === 'room') {
    const room = roomById(sel.id);
    d.orig = JSON.stringify(room.rects);
    d.doors = roomDoors(layer, room).map((x) => ({ o: x, x: x.x, y: x.y }));
    d.cams = [...roomCams(layer, room), ...roomShafts(layer, room)].map((x) => ({ o: x, x: x.x, y: x.y }));
    d.idPos = layer.rooms[room.id]?.idPos ? { ...layer.rooms[room.id].idPos } : null;
  } else if (sel.kind === 'corr') {
    d.orig = JSON.stringify(level.corridors[sel.id]);
  } else if (sel.kind === 'lift') {
    d.orig = JSON.stringify(level.lifts.find((l) => l.id === sel.id).rect);
  }
  st.drag = d;
  svg.setPointerCapture(e.pointerId);
}

function movePlan(d, pt) {
  const dx = snap(pt.x - d.start.x, SNAP);
  const dy = snap(pt.y - d.start.y, SNAP);
  if (!d.moved) {
    if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 6) return;
    d.moved = true;
    snapshot();
  }
  const sh = (r) => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy, ...r.slice(4)];
  const orig = JSON.parse(d.orig);
  if (d.sel.kind === 'room') {
    roomById(d.sel.id).rects = orig.map(sh);
    d.doors.forEach((x) => { x.o.x = x.x + dx; x.o.y = x.y + dy; });
    d.cams.forEach((x) => { x.o.x = x.x + dx; x.o.y = x.y + dy; });
    if (d.idPos) layer.rooms[d.sel.id].idPos = { x: d.idPos.x + dx, y: d.idPos.y + dy };
  } else if (d.sel.kind === 'corr') {
    level.corridors[d.sel.id] = sh(orig);
  } else if (d.sel.kind === 'lift') {
    level.lifts.find((l) => l.id === d.sel.id).rect = sh(orig);
  }
  render();
}

// Größe ändern über einen Eckanfasser
function startResize(e, tag) {
  const [kind, part, corner] = tag.split(':');
  const rect = kind === 'room' ? roomById(st.sel.id).rects[Number(part)] : level.corridors[st.sel.id];
  st.drag = { type: 'resize', kind, part: Number(part), corner: Number(corner), orig: rect.slice(), moved: false };
  snapshot();
  svg.setPointerCapture(e.pointerId);
}

function resizePlan(d, pt) {
  const o = d.orig;
  const [ix, iy] = CORNERS[d.corner];
  const ox = o[ix === 0 ? 2 : 0];   // gegenüberliegende Ecke bleibt fest
  const oy = o[iy === 1 ? 3 : 1];
  const step = stepOf();
  let nx = ox + stepLen(pt.x - ox, step);
  let ny = oy + stepLen(pt.y - oy, step);
  // Korridor ohne Strg: Breite bleibt, nur die Länge ändert sich
  if (d.kind === 'corr' && !st.ctrl) {
    if (o[2] - o[0] >= o[3] - o[1]) ny = o[iy]; else nx = o[ix];
  }
  const out = [Math.min(ox, nx), Math.min(oy, ny), Math.max(ox, nx), Math.max(oy, ny), ...o.slice(4)];
  d.moved = true;
  if (d.kind === 'room') roomById(st.sel.id).rects[d.part] = out;
  else level.corridors[st.sel.id] = out;
  render();
}

// ---------- Mehrfachauswahl ----------

const sameItem = (a, b) => a.kind === b.kind && a.id === b.id;
const inMulti = (it) => st.multi.some((x) => sameItem(x, it));

// Objekt unter dem Mauszeiger: Tür/Kamera/Linie/Beschriftung, Aufzug, Raum, Korridor
function itemAt(e, pt) {
  const obj = objectAt(e);
  if (obj) return obj.kind === 'rid' ? { kind: 'room', id: obj.id } : obj;
  const lift = e.target.closest?.('[data-lift]');
  if (lift) return { kind: 'lift', id: lift.dataset.lift };
  return planAt(pt);
}

function setMulti(list) {
  st.multi = list;
  st.sel = list.length === 1 ? list[0] : null;
  if (list.length === 1) st.multi = [];
  render();
  renderProps();
}

function toggleMulti(it) {
  const base = st.multi.length ? st.multi.slice() : st.sel ? [st.sel] : [];
  const i = base.findIndex((x) => sameItem(x, it));
  if (i >= 0) base.splice(i, 1); else base.push(it);
  setMulti(base);
}

// Alle Objekte vollständig im Rahmen
function itemsIn(r) {
  const inside = (x0, y0, x1, y1) => x0 >= r[0] && y0 >= r[1] && x1 <= r[2] && y1 <= r[3];
  const out = [];
  level.rooms.forEach((room) => { const b = bbox(room.rects); if (inside(...b)) out.push({ kind: 'room', id: room.id }); });
  level.corridors.forEach((c, i) => { if (inside(c[0], c[1], c[2], c[3])) out.push({ kind: 'corr', id: i }); });
  level.lifts.forEach((l) => { if (inside(...l.rect.slice(0, 4))) out.push({ kind: 'lift', id: l.id }); });
  layer.doors.forEach((d) => { if (inside(d.x, d.y, d.x, d.y)) out.push({ kind: 'door', id: d.id }); });
  layer.cams.forEach((c) => { if (inside(c.x, c.y, c.x, c.y)) out.push({ kind: 'cam', id: c.id }); });
  layer.shafts.forEach((x) => { if (inside(x.x, x.y, x.x + SHAFT, x.y + SHAFT)) out.push({ kind: 'shaft', id: x.id }); });
  layer.lines.forEach((l) => { if (inside(Math.min(l.x1, l.x2), Math.min(l.y1, l.y2), Math.max(l.x1, l.x2), Math.max(l.y1, l.y2))) out.push({ kind: 'line', id: l.id }); });
  planLabels(level, layer).forEach((l) => { if (inside(l.x, l.y, l.x, l.y)) out.push({ kind: 'label', id: l.id }); });
  return out;
}

const selection = () => (st.multi.length ? st.multi : st.sel ? [st.sel] : []);

// Gruppe verschieben: Räume nehmen ihre Türen, Kameras und Raum-ID mit
function startGroupMove(e, pt) {
  const doors = new Map();
  const cams = new Map();
  const items = st.multi.map((it) => {
    if (it.kind === 'room') {
      const room = roomById(it.id);
      roomDoors(layer, room).forEach((d) => doors.set(d.id, { o: d, x: d.x, y: d.y }));
      roomCams(layer, room).forEach((c) => cams.set(c.id, { o: c, x: c.x, y: c.y }));
      roomShafts(layer, room).forEach((c) => cams.set(c.id, { o: c, x: c.x, y: c.y }));
      const idPos = layer.rooms[room.id]?.idPos;
      return { it, rects: deep(room.rects), idPos: idPos ? { ...idPos } : null };
    }
    if (it.kind === 'corr') return { it, rect: level.corridors[it.id].slice() };
    if (it.kind === 'lift') return { it, rect: level.lifts.find((l) => l.id === it.id).rect.slice() };
    if (it.kind === 'door') { const d = find('door', it.id); doors.set(d.id, { o: d, x: d.x, y: d.y }); return null; }
    if (it.kind === 'cam' || it.kind === 'shaft') { const c = find(it.kind, it.id); cams.set(c.id, { o: c, x: c.x, y: c.y }); return null; }
    if (it.kind === 'line') return { it, line: { ...find('line', it.id) } };
    if (it.kind === 'label') { const l = find('label', it.id); return { it, x: l.x, y: l.y }; }
    return null;
  }).filter(Boolean);
  st.drag = { type: 'gmove', start: pt, items, doors: [...doors.values()], cams: [...cams.values()], moved: false };
  svg.setPointerCapture(e.pointerId);
}

function moveGroup(d, pt) {
  const dx = snap(pt.x - d.start.x, SNAP);
  const dy = snap(pt.y - d.start.y, SNAP);
  if (!d.moved) {
    if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 6) return;
    d.moved = true;
    snapshot();
  }
  const sh = (r) => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy, ...r.slice(4)];
  for (const x of d.items) {
    const { it } = x;
    if (it.kind === 'room') {
      roomById(it.id).rects = x.rects.map(sh);
      if (x.idPos) layer.rooms[it.id].idPos = { x: x.idPos.x + dx, y: x.idPos.y + dy };
    } else if (it.kind === 'corr') level.corridors[it.id] = sh(x.rect);
    else if (it.kind === 'lift') level.lifts.find((l) => l.id === it.id).rect = sh(x.rect);
    else if (it.kind === 'line') Object.assign(find('line', it.id), { x1: x.line.x1 + dx, y1: x.line.y1 + dy, x2: x.line.x2 + dx, y2: x.line.y2 + dy });
    else if (it.kind === 'label') patchLabel(it.id, { x: x.x + dx, y: x.y + dy });
  }
  d.doors.forEach((x) => { x.o.x = x.x + dx; x.o.y = x.y + dy; });
  d.cams.forEach((x) => { x.o.x = x.x + dx; x.o.y = x.y + dy; });
  render();
}

function deleteMulti() {
  const list = st.multi;
  if (!confirm(`${list.length} ausgewählte Objekte löschen?`)) return;
  snapshot();
  const ids = (k) => new Set(list.filter((x) => x.kind === k).map((x) => x.id));
  const rooms = ids('room');
  level.rooms = level.rooms.filter((r) => !rooms.has(r.id));
  LV.plan.rooms = level.rooms;
  rooms.forEach((id) => delete layer.rooms[id]);
  [...ids('corr')].sort((a, b) => b - a).forEach((i) => level.corridors.splice(i, 1));
  const lifts = ids('lift');
  level.lifts = level.lifts.filter((l) => !lifts.has(l.id));
  LV.plan.lifts = level.lifts;
  lifts.forEach((id) => delete layer.lifts[id]);
  for (const [k, arr] of [['door', 'doors'], ['cam', 'cams'], ['line', 'lines'], ['shaft', 'shafts']]) {
    const s0 = ids(k);
    layer[arr] = layer[arr].filter((o) => !s0.has(o.id));
  }
  ids('label').forEach((id) => { if (layer.labels[id]?.custom) delete layer.labels[id]; else patchLabel(id, { hidden: true }); });
  st.multi = [];
  st.sel = null;
  commit();
  renderProps();
}

// ---------- Kopieren und Einfügen (Strg+C / Strg+V) ----------

const deep = (o) => JSON.parse(JSON.stringify(o));

// Kopie eines Objekts mit Bezugspunkt (obere linke Ecke)
function clipOf(sel) {
  if (sel.kind === 'room') {
    const room = roomById(sel.id);
    const info = deep(layer.rooms[room.id] || {});
    delete info.code;
    return { kind: 'room', room: deep(room), info, box: bbox(room.rects) };
  }
  if (sel.kind === 'corr') {
    const c = level.corridors[sel.id];
    return { kind: 'corr', rect: deep(c), box: c.slice(0, 4) };
  }
  if (sel.kind === 'lift') {
    const l = level.lifts.find((x) => x.id === sel.id);
    const info = deep(layer.lifts[l.id] || {});
    delete info.letter;
    return { kind: 'lift', lift: deep(l), info, box: l.rect.slice(0, 4) };
  }
  if (['door', 'cam', 'line', 'shaft'].includes(sel.kind)) {
    const o = find(sel.kind, sel.id);
    const box = sel.kind === 'line' ? [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2)] : [o.x, o.y];
    return { kind: sel.kind, obj: deep(o), box };
  }
  if (sel.kind === 'label') {
    const l = find('label', sel.id);
    return { kind: 'label', obj: { text: l.text, x: l.x, y: l.y }, box: [l.x, l.y] };
  }
  return null;
}

function copySel() {
  const items = selection().map(clipOf).filter(Boolean);
  if (!items.length) return;
  const box = [Math.min(...items.map((c) => c.box[0])), Math.min(...items.map((c) => c.box[1]))];
  st.clip = { items, box };
  toast(`${items.length > 1 ? `${items.length} OBJEKTE` : 'OBJEKT'} KOPIERT – STRG+V FÜGT AN DER MAUSPOSITION EIN`);
}

function pasteItem(c, dx, dy) {
  const sh = (r) => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy, ...deep(r.slice(4))];
  if (c.kind === 'room') {
    const room = { ...deep(c.room), id: nextRoomId(), rects: c.room.rects.map(sh) };
    level.rooms.push(room);
    const info = deep(c.info);
    if (info.idPos) info.idPos = { x: info.idPos.x + dx, y: info.idPos.y + dy };
    if (Object.keys(info).length) layer.rooms[room.id] = info;
    return { kind: 'room', id: room.id };
  }
  if (c.kind === 'corr') {
    level.corridors.push(sh(c.rect));
    return { kind: 'corr', id: level.corridors.length - 1 };
  }
  if (c.kind === 'lift') {
    const used = new Set(level.lifts.map((l) => l.id));
    const id = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((x) => !used.has(x)) || uid('L');
    level.lifts.push({ ...deep(c.lift), id, rect: sh(c.lift.rect) });
    if (Object.keys(c.info).length) layer.lifts[id] = deep(c.info);
    return { kind: 'lift', id };
  }
  if (c.kind === 'line') {
    const o = { ...deep(c.obj), id: uid('l'), x1: c.obj.x1 + dx, y1: c.obj.y1 + dy, x2: c.obj.x2 + dx, y2: c.obj.y2 + dy };
    layer.lines.push(o);
    return { kind: 'line', id: o.id };
  }
  if (c.kind === 'door' || c.kind === 'cam' || c.kind === 'shaft') {
    const o = { ...deep(c.obj), id: uid(c.kind[0]), x: c.obj.x + dx, y: c.obj.y + dy };
    listOf(c.kind).push(o);
    return { kind: c.kind, id: o.id };
  }
  if (c.kind === 'label') {
    const id = uid('lbl');
    layer.labels[id] = { custom: true, text: c.obj.text, x: c.obj.x + dx, y: c.obj.y + dy };
    return { kind: 'label', id };
  }
  return null;
}

function pasteClip() {
  const c = st.clip;
  if (!c) return;
  // Ziel: obere linke Ecke der Kopie an die Mausposition, sonst leicht versetzt
  const at = st.mouse ? snapP(st.mouse) : { x: c.box[0] + 50, y: c.box[1] + 50 };
  const dx = at.x - c.box[0];
  const dy = at.y - c.box[1];
  snapshot();
  const added = c.items.map((it) => pasteItem(it, dx, dy)).filter(Boolean);
  commit();
  setMulti(added);
}

function startPan(e, clickSelectsRoom = false) {
  st.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: { ...st.vb }, moved: false, clickSelectsRoom, pt: toMap(e) };
  svg.setPointerCapture(e.pointerId);
}

function onMove(e) {
  const pt = toMap(e);
  st.ctrl = e.ctrlKey || e.metaKey;
  st.mouse = pt;
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
  if (d.type === 'draw') { drawUi(pt); return; }
  if (d.type === 'ctrlsel') {
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.moved) { d.end = pt; drawUi(pt); }
    return;
  }
  if (d.type === 'gmove') { moveGroup(d, pt); return; }
  if (d.type === 'pmove') { movePlan(d, pt); return; }
  if (d.type === 'resize') { resizePlan(d, pt); return; }
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
      const dx = snap(pt.x - d.start.x, MM);
      const dy = snap(pt.y - d.start.y, MM);
      Object.assign(obj, { x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy });
    } else if (st.sel.kind === 'shaft') {
      obj.x = orig.x + snap(pt.x - d.start.x, SNAP);
      obj.y = orig.y + snap(pt.y - d.start.y, SNAP);
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
    select(planAt(d.pt));
    return;
  }
  if (d.type === 'draw') { st.ctrl = e.ctrlKey || e.metaKey; finishDraw(d, toMap(e)); drawUi(); return; }
  if (d.type === 'ctrlsel') {
    if (d.moved && d.end) {
      const r = norm4(d.start, d.end);
      const base = st.multi.length ? st.multi.slice() : st.sel ? [st.sel] : [];
      itemsIn(r).forEach((it) => { if (!base.some((x) => sameItem(x, it))) base.push(it); });
      setMulti(base);
    } else if (d.hit) toggleMulti(d.hit);
    drawUi();
    return;
  }
  if (d.type === 'resize' && !d.moved) { st.undo.pop(); updateButtons(); return; }
  if (d.type === 'handle' || ((d.type === 'move' || d.type === 'rid' || d.type === 'pmove' || d.type === 'resize' || d.type === 'gmove') && d.moved)) {
    commit();
    renderProps();
  }
  try { svg.releasePointerCapture(e.pointerId); } catch { /* egal */ }
}

// ---------- Export / Import ----------

// Export: alle Karten mit Ebenen, deren Türen/Kameras/Raumdaten, Ausrüstung und Terminal-Texte
function exportLayer() {
  const layers = {};
  plans.maps.forEach((mp) => mp.levels.forEach((lv) => { layers[lv.id] = lv.id === LV.id ? layer : loadLayer(lv.id, LAYER_FALLBACK[lv.id]); }));
  const clean = JSON.parse(JSON.stringify(plans));
  clean.maps.forEach((mp) => mp.levels.forEach((lv) => { delete lv.plan.bounds; delete lv.plan.mapName; }));
  const data = { format: 'apollo-map-layer', version: 5, level: LV.id, layer, plans: clean, layers, equipment: exportEquipment(), content: currentContent() };
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'apollo-karten.json');
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
  interact: 'Interaktion',
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
    blocks.push({ kv: ['Cluttered', e.d.cluttered ? 'Ja' : 'Nein'] });
    blocks.push({ kv: ['Status', STATUS[e.d.status || '']] });
    const shafts = roomShafts(layer, e.room);
    if (shafts.length) blocks.push({ kv: ['Schachtzugänge', shafts.map((x) => `${x.sid || e.code}${x.hidden ? ' [nicht im Terminal]' : ''}${x.note ? ` (${x.note})` : ''}`).join('; ')] });
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
      if (data.plans) {
        // Neues Format: alle Karten und Ebenen ersetzen
        plans = normPlans(data.plans);
        savePlans(plans);
        Object.entries(data.layers || {}).forEach(([id, l]) => saveLayer(id, importLayer(l)));
        if (data.equipment) importEquipment(data.equipment);
        if (data.content) { saveContent(data.content); contentEd?.refresh(); }
        switchLevel(0, 0);
        toast('KARTEN IMPORTIERT');
        return;
      }
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
    getLevel: () => level,
    getLayer: () => layer,
    setRoomStatus: (id, status) => { snapshot(); patchRoom(id, { status }); commit(); },
    toast,
  });
  const show = (k) => {
    document.querySelectorAll('.ed-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
    document.body.classList.toggle('tab-content', k !== 'map');
    $('#content').hidden = k === 'map';
    $('#ed-sub').textContent = k === 'map' ? `// ${MAP.name} · ${level.name}` : '// TERMINAL-INHALTE';
    if (k === 'map') { render(); renderProps(); } else contentEd.show(k);
    try { sessionStorage.setItem('apollo.editor.tab', k); } catch { /* egal */ }
  };
  document.querySelectorAll('.ed-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  let start = 'map';
  try { start = sessionStorage.getItem('apollo.editor.tab') || 'map'; } catch { /* egal */ }
  show(tabs.some(([k]) => k === start) ? start : 'map');
}

function init() {
  renderLevelPick();
  const toolBtn = (t) => `<button class="ed-tool" data-tool="${t.id}"><span class="k">${t.key.toUpperCase()}</span>${t.label}</button>`;
  $('#tools').innerHTML = TOOL_GROUPS.map(([g, title], i) => `${i ? `<div class="ed-head">${title}</div>` : ''}${TOOLS.filter((t) => t.group === g).map(toolBtn).join('')}${g === 'plan' ? '<div id="zonemode" class="ed-zonemode" hidden><button data-zm="line">LINIE</button><button data-zm="box">KASTEN</button></div>' : ''}`).join('');
  document.querySelectorAll('[data-zm]').forEach((b) => b.addEventListener('click', () => setZoneMode(b.dataset.zm)));
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
    if (!confirm('Alle Türen, Zonen, Kameras, Schachtzugänge und Raumdaten dieser Ebene löschen?')) return;
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

  const ctrlPreview = (e) => {
    const c = e.ctrlKey || e.metaKey;
    if (c === st.ctrl) return;
    st.ctrl = c;
    if (st.drag?.type === 'draw' && st.mouse) drawUi(st.mouse);
  };
  addEventListener('keyup', ctrlPreview);
  addEventListener('keydown', (e) => {
    ctrlPreview(e);
    if (e.key === 'Escape' && !equip.hidden) { closeEquip(); return; }
    if (e.key === 'Escape' && !detail.hidden) { closeDetail(); return; }
    if (e.target.closest('input, textarea, select')) return;
    if (!detail.hidden || !equip.hidden) return;
    if (document.body.classList.contains('tab-content')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'c') { e.preventDefault(); copySel(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'v') { e.preventDefault(); pasteClip(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key === k);
    if (t) { setTool(t.id); return; }
    if (k === 'escape') { if (st.lineStart) { st.lineStart = null; drawUi(); } else { st.append = null; select(null); } return; }
    if ((k === 'delete' || k === 'backspace') && st.multi.length > 1) { e.preventDefault(); deleteMulti(); return; }
    if ((k === 'delete' || k === 'backspace') && st.sel) {
      e.preventDefault();
      if (['room', 'corr', 'lift'].includes(st.sel.kind)) deletePlanItem(st.sel); else remove(st.sel.kind, st.sel.id);
      return;
    }
    if (k === 'g') setSec('green');
    if (k === 'o') setSec('orange');
    if (k === 'r') setSec('red');
  });

  // Änderungen aus einem anderen Editor-Fenster übernehmen
  addEventListener('storage', (e) => {
    if (e.key === storageKey(LV.id)) { layer = loadLayer(LV.id, LAYER_FALLBACK[LV.id]); validateSel(); render(); renderProps(); }
    if (e.key === PLANS_KEY) { plans = loadPlans(); bindLevel(); validateSel(); render(); renderProps(); renderLevelPick(); }
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
