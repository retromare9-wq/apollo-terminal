// GM-Karte: Tokens setzen und bewegen, Notizen, Motion-Tracker-Pings, Türen und Kameras
// für die Spieler freigeben, Ausschnitt an die Spielerkarte senden.
import { loadContent } from './content.js';
import { applyZoom } from './stationplan.js';
import {
  loadTable, saveTable, onTableChange, drawTable, allLevels, startLevel,
  KINDS, KIND_COLOR, PING_MS, uid,
} from './table.js';

loadContent();

const $ = (s) => document.querySelector(s);
const svg = $('#map');
const side = $('#side');
const menu = $('#menu');
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let t = loadTable();
let levels = allLevels();
let lv = null;
const st = { vb: null, sel: null, drag: null, menuPt: null };
const LV_KEY = 'apollo.gm.level';

// ---------- Ansicht ----------

function setVB(r) {
  st.vb = r;
  svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`);
  applyZoom(svg, r.w / (svg.clientWidth || 1000));
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

function render() {
  drawTable(svg, lv, t, 'gm');
  if (st.sel) svg.querySelector(`[data-${st.sel.kind}="${st.sel.id}"]`)?.classList.add('tt-sel');
  setVB(st.vb);
  renderPlayerState();
}

function commit() {
  if (!saveTable(t)) toast('SPEICHERN FEHLGESCHLAGEN');
  render();
  renderSide();
}

function selectLevel(id, keepView = false) {
  lv = levels.find((l) => l.id === id) || startLevel(levels);
  try { localStorage.setItem(LV_KEY, lv.id); } catch { /* egal */ }
  $('#lvl').value = lv.id;
  if (!keepView || !st.vb) homeView();
  render();
  renderSide();
}

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function renderPlayerState() {
  const p = t.player && levels.find((l) => l.id === t.player.levelId);
  $('#pstate').textContent = p ? `SPIELER SEHEN: ${p.plan.name}` : 'SPIELER SEHEN: STARTANSICHT';
  const rev = t.doors[lv.id]?.all;
  $('#doors-all').textContent = rev ? 'TÜREN: AUFGEDECKT' : 'TÜREN: GRAU';
  $('#doors-all').classList.toggle('hot', !!rev);
}

// ---------- Objekte ----------

const findTok = (id) => t.tokens.find((k) => k.id === id);
const findNote = (id) => t.notes.find((n) => n.id === id);

function newToken(at) {
  const k = { id: uid('t'), name: 'NEUER TOKEN', kind: 'npc', color: KIND_COLOR.npc, size: 1, hidden: false, img: '', levelId: at ? lv.id : null, x: at?.x || 0, y: at?.y || 0 };
  t.tokens.push(k);
  st.sel = { kind: 'token', id: k.id };
  commit();
  side.querySelector('[data-f="name"]')?.select();
}

function placeToken(k, at) {
  Object.assign(k, { levelId: lv.id, x: Math.round(at.x), y: Math.round(at.y) });
  st.sel = { kind: 'token', id: k.id };
  commit();
}

function addNote(at) {
  const n = { id: uid('n'), levelId: lv.id, x: Math.round(at.x), y: Math.round(at.y), text: 'NOTIZ', color: '#e3cb5c', visible: false };
  t.notes.push(n);
  st.sel = { kind: 'note', id: n.id };
  commit();
  side.querySelector('[data-f="text"]')?.select();
}

function addPing(at, keep) {
  t.pings.push({ id: uid('p'), levelId: lv.id, x: Math.round(at.x), y: Math.round(at.y), t: Date.now(), keep: !!keep });
  commit();
  if (!keep) setTimeout(() => { t = loadTable(); render(); }, PING_MS + 100);
}

function centerPt() {
  return { x: st.vb.x + st.vb.w / 2, y: st.vb.y + st.vb.h / 2 };
}

// ---------- Seitenleiste ----------

const KIND_OPTS = Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

function tokenRow(k) {
  const where = k.levelId ? (levels.find((l) => l.id === k.levelId)?.plan.name || '?') : 'VORRAT';
  const sw = k.img ? `<img src="${esc(k.img)}" alt="" style="border-color:${esc(k.color)}">` : `<i style="background:${esc(k.color)}"></i>`;
  return `<button class="gm-trow ${st.sel?.kind === 'token' && st.sel.id === k.id ? 'on' : ''}" data-tsel="${k.id}">${sw}<span class="n">${esc(k.name)}</span><span class="dim">${k.hidden ? '👁‍🗨 ' : ''}${esc(where)}</span></button>`;
}

function renderSide() {
  const sel = st.sel;
  let form = '';
  if (sel?.kind === 'token' && findTok(sel.id)) {
    const k = findTok(sel.id);
    form = `
      <div class="gm-head">TOKEN</div>
      <label class="gm-f">NAME <input data-f="name" value="${esc(k.name)}" maxlength="30"></label>
      <div class="gm-row">
        <label class="gm-f">KÜRZEL <input data-f="short" value="${esc(k.short)}" maxlength="2" placeholder="auto"></label>
        <label class="gm-f">FARBE <input type="color" data-f="color" value="${esc(k.color || KIND_COLOR[k.kind])}"></label>
        <label class="gm-f">GRÖSSE <select data-f="size">${[0.75, 1, 1.5, 2, 3].map((v) => `<option value="${v}" ${Number(k.size || 1) === v ? 'selected' : ''}>${v}×</option>`).join('')}</select></label>
      </div>
      <label class="gm-f">ART <select data-f="kind">${KIND_OPTS}</select></label>
      <label class="gm-check"><input type="checkbox" data-f="hidden" ${k.hidden ? 'checked' : ''}> FÜR SPIELER VERSTECKT</label>
      <div class="gm-img">${k.img ? `<img src="${esc(k.img)}" alt="" style="border-color:${esc(k.color)}">` : '<span class="dim">KEIN BILD</span>'}
        <button data-a="img">BILD …</button>${k.img ? '<button data-a="noimg" class="danger">✕</button>' : ''}</div>
      <div class="gm-btns">
        ${k.levelId === lv.id ? '<button data-a="center">ZEIGEN</button><button data-a="stash">IN DEN VORRAT</button>'
          : `<button data-a="place">AUF KARTE SETZEN</button>${k.levelId ? '<button data-a="goto">ZUR EBENE</button>' : ''}`}
        <button data-a="del" class="danger">LÖSCHEN</button>
      </div>`;
  } else if (sel?.kind === 'note' && findNote(sel.id)) {
    const n = findNote(sel.id);
    form = `
      <div class="gm-head">NOTIZ</div>
      <label class="gm-f">TEXT <textarea data-f="text" rows="4" maxlength="400">${esc(n.text)}</textarea></label>
      <div class="gm-row"><label class="gm-f">FARBE <input type="color" data-f="color" value="${esc(n.color || '#e3cb5c')}"></label></div>
      <label class="gm-check"><input type="checkbox" data-f="visible" ${n.visible ? 'checked' : ''}> AUF DER SPIELERKARTE ZEIGEN</label>
      <div class="gm-btns"><button data-a="del" class="danger">LÖSCHEN</button></div>`;
  }
  const list = t.tokens.slice().sort((a, b) => (a.levelId ? 1 : 0) - (b.levelId ? 1 : 0) || a.name.localeCompare(b.name, 'de'));
  side.innerHTML = `${form}
    <div class="gm-head">TOKENS (${t.tokens.length})</div>
    <div class="gm-btns"><button data-a="new">+ NEUER TOKEN</button></div>
    <div class="gm-tlist">${list.map(tokenRow).join('') || '<p class="dim">Noch keine Tokens. Lege sie hier vorab an – sie bleiben gespeichert.</p>'}</div>
    <p class="gm-note">Tokens im VORRAT sind angelegt, aber nicht auf der Karte. Rechtsklick auf die Karte → „Token hier platzieren“.</p>`;
  bindSide();
}

function bindSide() {
  side.querySelectorAll('[data-tsel]').forEach((b) => b.addEventListener('click', () => {
    st.sel = { kind: 'token', id: b.dataset.tsel };
    render();
    renderSide();
  }));
  side.querySelector('[data-a="new"]')?.addEventListener('click', () => newToken(null));
  const sel = st.sel;
  const obj = sel?.kind === 'token' ? findTok(sel.id) : sel?.kind === 'note' ? findNote(sel.id) : null;
  if (!obj) return;
  const kindSel = side.querySelector('[data-f="kind"]');
  if (kindSel) kindSel.value = obj.kind || 'npc';
  side.querySelectorAll('[data-f]').forEach((inp) => {
    const f = inp.dataset.f;
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      let v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (f === 'size') v = Number(v);
      if (f === 'name' || f === 'short') v = String(v).toUpperCase();
      if (f === 'kind' && (!obj.color || obj.color === KIND_COLOR[obj.kind])) obj.color = KIND_COLOR[v];
      obj[f] = v;
      saveTable(t);
      render();
      if (ev === 'change') renderSide();
      else side.querySelectorAll('.gm-trow.on .n').forEach((s) => { s.textContent = obj.name; });
    });
  });
  const act = (a, fn) => side.querySelector(`[data-a="${a}"]`)?.addEventListener('click', fn);
  act('del', () => {
    if (!confirm(sel.kind === 'token' ? `Token „${obj.name}“ löschen?` : 'Notiz löschen?')) return;
    if (sel.kind === 'token') t.tokens = t.tokens.filter((k) => k !== obj); else t.notes = t.notes.filter((n) => n !== obj);
    st.sel = null;
    commit();
  });
  act('place', () => placeToken(obj, centerPt()));
  act('stash', () => { obj.levelId = null; commit(); });
  act('goto', () => { selectLevel(obj.levelId); centerOn(obj); });
  act('center', () => centerOn(obj));
  act('noimg', () => { obj.img = ''; commit(); });
  act('img', () => {
    const f = document.createElement('input');
    f.type = 'file';
    f.accept = 'image/*';
    f.onchange = async () => {
      if (!f.files[0]) return;
      try { obj.img = await squareImage(f.files[0]); commit(); } catch { toast('BILD KONNTE NICHT GELESEN WERDEN'); }
    };
    f.click();
  });
}

function centerOn(o) {
  setVB({ ...st.vb, x: o.x - st.vb.w / 2, y: o.y - st.vb.h / 2 });
}

// Bild quadratisch (Mitte, oben betont) auf 160 px zuschneiden
function squareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = Math.max(0, (img.height - s) * 0.25);
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 160;
      cv.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

// ---------- Kontextmenü ----------

function openMenu(e) {
  e.preventDefault();
  const at = toMap(e);
  st.menuPt = at;
  const tg = e.target;
  const tokEl = tg.closest?.('[data-token]');
  const noteEl = tg.closest?.('[data-note]');
  const pingEl = tg.closest?.('[data-ping]');
  const doorEl = tg.closest?.('[data-door]');
  const camEl = tg.closest?.('[data-cam]');
  const items = [];
  if (tokEl) {
    const k = findTok(tokEl.dataset.token);
    st.sel = { kind: 'token', id: k.id };
    items.push(['head', esc(k.name)], ['edit', 'BEARBEITEN'], ['tvis', k.hidden ? 'FÜR SPIELER SICHTBAR MACHEN' : 'FÜR SPIELER VERSTECKEN'],
      ['tping', 'PING AM TOKEN'], ['tstash', 'IN DEN VORRAT'], ['tdel', 'LÖSCHEN', 'danger'], ['sep']);
  } else if (noteEl) {
    const n = findNote(noteEl.dataset.note);
    st.sel = { kind: 'note', id: n.id };
    items.push(['head', 'NOTIZ'], ['edit', 'BEARBEITEN'], ['nvis', n.visible ? 'AUF SPIELERKARTE AUSBLENDEN' : 'AUF SPIELERKARTE ZEIGEN'], ['ndel', 'LÖSCHEN', 'danger'], ['sep']);
  } else if (pingEl) {
    items.push(['head', 'PING'], ['pdel', 'PING ENTFERNEN', 'danger'], ['sep']);
    st.menuPing = pingEl.dataset.ping;
  } else if (camEl) {
    st.menuCam = camEl.dataset.cam;
    const on = t.cams[lv.id]?.[st.menuCam];
    items.push(['head', 'KAMERA'], ['cam', on ? 'FÜR SPIELER VERBERGEN' : 'FÜR SPIELER ZEIGEN'], ['sep']);
  } else if (doorEl) {
    st.menuDoor = doorEl.dataset.door;
    const on = t.doors[lv.id]?.ids?.[st.menuDoor] || t.doors[lv.id]?.all;
    items.push(['head', 'TÜR'], ['door', on ? 'TÜRFARBE FÜR SPIELER VERDECKEN (GRAU)' : 'TÜRFARBE FÜR SPIELER AUFDECKEN'], ['sep']);
  }
  const elsewhere = t.tokens.filter((k) => k.levelId !== lv.id);
  items.push(['head', 'HIER']);
  items.push(['sub', 'TOKEN HIER PLATZIEREN']);
  elsewhere.slice(0, 30).forEach((k) => items.push([`place:${k.id}`, `${esc(k.name)}<span class="dim"> · ${k.levelId ? esc(levels.find((l) => l.id === k.levelId)?.plan.name || '') : 'VORRAT'}</span>`, 'indent', k.color]));
  items.push(['newtok', '+ NEUER TOKEN', 'indent']);
  items.push(['note', 'NOTIZ HIER'], ['ping', 'MOTION-TRACKER-PING'], ['pingk', 'PING (BLEIBT)'], ['sep'], ['view', 'AUSSCHNITT AN SPIELER ▶']);
  menu.innerHTML = items.map(([a, label, cls, color]) => {
    if (a === 'sep') return '<hr>';
    if (a === 'head' || a === 'sub') return `<div class="gm-mhead${a === 'sub' ? ' sub' : ''}">${label}</div>`;
    return `<button data-m="${esc(a)}" class="${cls || ''}">${color ? `<i style="background:${esc(color)}"></i>` : ''}${label}</button>`;
  }).join('');
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, innerWidth - r.width - 8)}px`;
  menu.style.top = `${Math.min(e.clientY, innerHeight - r.height - 8)}px`;
  menu.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { menu.hidden = true; menuAction(b.dataset.m); }));
  render();
  renderSide();
}

function menuAction(a) {
  const at = st.menuPt;
  const k = st.sel?.kind === 'token' ? findTok(st.sel.id) : null;
  const n = st.sel?.kind === 'note' ? findNote(st.sel.id) : null;
  if (a.startsWith('place:')) { placeToken(findTok(a.slice(6)), at); return; }
  switch (a) {
    case 'edit': side.querySelector('[data-f]')?.focus(); break;
    case 'tvis': k.hidden = !k.hidden; commit(); break;
    case 'tping': addPing(k, false); break;
    case 'tstash': k.levelId = null; st.sel = null; commit(); break;
    case 'tdel': if (confirm(`Token „${k.name}“ löschen?`)) { t.tokens = t.tokens.filter((x) => x !== k); st.sel = null; commit(); } break;
    case 'nvis': n.visible = !n.visible; commit(); break;
    case 'ndel': t.notes = t.notes.filter((x) => x !== n); st.sel = null; commit(); break;
    case 'pdel': t.pings = t.pings.filter((p) => p.id !== st.menuPing); commit(); break;
    case 'cam': {
      const c = (t.cams[lv.id] = t.cams[lv.id] || {});
      if (c[st.menuCam]) delete c[st.menuCam]; else c[st.menuCam] = true;
      commit();
      break;
    }
    case 'door': {
      const d = (t.doors[lv.id] = t.doors[lv.id] || { ids: {} });
      d.ids = d.ids || {};
      const on = d.ids[st.menuDoor] || d.all;
      if (on) { if (d.all) { d.all = false; allDoorsExcept(d, st.menuDoor); } else delete d.ids[st.menuDoor]; } else d.ids[st.menuDoor] = true;
      commit();
      break;
    }
    case 'newtok': newToken(at); break;
    case 'note': addNote(at); break;
    case 'ping': addPing(at, false); break;
    case 'pingk': addPing(at, true); break;
    case 'view': sendView(); break;
    default:
  }
}

// „Alle aufgedeckt“ in Einzelfreigaben auflösen, eine Tür ausgenommen
function allDoorsExcept(d, id) {
  svg.querySelectorAll('[data-door]').forEach((n) => { if (n.dataset.door !== id) d.ids[n.dataset.door] = true; });
}

function sendView() {
  t.player = { levelId: lv.id, vb: { ...st.vb } };
  commit();
  toast('SPIELER SEHEN JETZT DIESEN AUSSCHNITT');
}

// ---------- Maus ----------

function onDown(e) {
  if (e.button !== 0) return;
  menu.hidden = true;
  const pt = toMap(e);
  const tokEl = e.target.closest?.('[data-token]');
  const noteEl = e.target.closest?.('[data-note]');
  if (tokEl || noteEl) {
    const o = tokEl ? findTok(tokEl.dataset.token) : findNote(noteEl.dataset.note);
    st.sel = { kind: tokEl ? 'token' : 'note', id: o.id };
    st.drag = { type: 'obj', o, start: pt, ox: o.x, oy: o.y, moved: false };
  } else {
    st.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vb: { ...st.vb }, moved: false };
  }
  svg.setPointerCapture(e.pointerId);
}

function onMove(e) {
  const d = st.drag;
  if (!d) return;
  if (d.type === 'pan') {
    const k = st.vb.w / svg.clientWidth;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    setVB({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * k, y: d.vb.y - (e.clientY - d.sy) * k });
    return;
  }
  const pt = toMap(e);
  if (!d.moved && Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 3) return;
  d.moved = true;
  d.o.x = Math.round(d.ox + pt.x - d.start.x);
  d.o.y = Math.round(d.oy + pt.y - d.start.y);
  const node = svg.querySelector(`[data-${st.sel.kind}="${d.o.id}"]`);
  node?.setAttribute('transform', `translate(${d.o.x} ${d.o.y})`);
}

function onUp() {
  const d = st.drag;
  st.drag = null;
  if (!d) return;
  if (d.type === 'obj') { commit(); return; }
  if (!d.moved && st.sel) { st.sel = null; render(); renderSide(); }
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

function init() {
  fillLevels();
  $('#lvl').addEventListener('change', (e) => selectLevel(e.target.value));
  $('#open-player').addEventListener('click', openPlayer);
  $('#send-view').addEventListener('click', sendView);
  $('#doors-all').addEventListener('click', () => {
    const d = (t.doors[lv.id] = t.doors[lv.id] || { ids: {} });
    d.all = !d.all;
    if (!d.all) d.ids = {};
    commit();
  });
  $('#pings-clear').addEventListener('click', () => { t.pings = t.pings.filter((p) => p.levelId !== lv.id); commit(); });
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('contextmenu', openMenu);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toMap(e);
    const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const w = Math.min(Math.max(st.vb.w * f, 150), 12000);
    const k = w / st.vb.w;
    setVB({ x: p.x - (p.x - st.vb.x) * k, y: p.y - (p.y - st.vb.y) * k, w, h: st.vb.h * k });
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { menu.hidden = true; st.sel = null; render(); renderSide(); }
  });
  addEventListener('pointerdown', (e) => { if (!menu.contains(e.target) && e.target !== svg && !svg.contains(e.target)) menu.hidden = true; });
  addEventListener('resize', () => setVB({ ...st.vb, h: st.vb.w * (svg.clientHeight / svg.clientWidth) }));
  onTableChange(() => {
    if (st.drag) return;
    t = loadTable();
    const id = lv?.id;
    fillLevels();
    lv = levels.find((l) => l.id === id) || startLevel(levels);
    $('#lvl').value = lv.id;
    render();
    renderSide();
  });
  let start = null;
  try { start = localStorage.getItem(LV_KEY); } catch { /* egal */ }
  selectLevel(levels.some((l) => l.id === start) ? start : startLevel(levels)?.id);
}

init();
window.__apolloReady = true;
