import { CONFIG, TOPICS, MENU, PERSONNEL, STATION, DEMO_REPLIES, COMMLOG, SYSTEMS, SELFDESTRUCT, ACCESS } from './data.js';
import { matchTopic, normalize } from './matcher.js';
import { sound } from './sound.js';
import { runBoot } from './boot.js';
import { MapView, LEVELS } from './maps.js';
import { wyLogo } from './logo.js';
import { loadContent, CONTENT_KEY } from './content.js';
import { loadLayer, STATUS } from './layer.js';
import { roomName } from './stationplan.js';

loadContent();

const $ = (s, root = document) => root.querySelector(s);
const view = $('#view');

const state = {
  ready: false,
  view: 'menu',
  menuIndex: 0,
  personIndex: 0,
  buffer: '',
  busy: false,
  typing: null,
  map: null,
  chat: null,
  user: null, // { name, level: 'green'|'orange'|'red', mainframe }
  login: null,
  logIndex: 0,
  sysIndex: 0,
  sd: null, // Selbstzerstörungs-Dialog
  destruct: null, // laufender Countdown
};

// ---------- Zugangsstufen ----------

const RANK = { green: 0, orange: 1, red: 2, mainframe: 3 };
const userRank = () => (!state.user ? -1 : state.user.mainframe ? 3 : RANK[state.user.level] ?? 0);
const canSee = (access) => (RANK[access] ?? 1) <= userRank();
const levelName = () => (state.user ? (state.user.mainframe ? ACCESS.mainframe : ACCESS[state.user.level]) : '–');
const levelClass = () => (state.user ? `lvl-${state.user.mainframe ? 'red' : state.user.level}` : '');
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVYZ'; // W und X sind für Zugang und Abmelden reserviert

// Sichtbare Menüpunkte mit automatisch vergebenen Tasten
function visibleMenu() {
  return MENU.filter((m) => {
    const t = topicById(m.topic);
    return t && canSee(t.access);
  }).map((m, i) => ({ ...m, key: KEYS[i] || '' }));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CRIT = /(?<![A-ZÄÖÜ])(KRITISCH|SCHADEN|ABGERIEGELT|OFFLINE|AUSGEFALLEN|NICHT ERREICHBAR|FEHLER|UNBEKANNT)(?![A-ZÄÖÜ])/g;
const WARN = /(?<![A-ZÄÖÜ])(WARNUNG|EINGESCHRÄNKT)(?![A-ZÄÖÜ])/g;
const colorize = (s) => esc(s).replace(CRIT, '<span class="crit">$1</span>').replace(WARN, '<span class="warn">$1</span>');
const pad = (n, l = 2) => String(n).padStart(l, '0');
const topicById = (id) => TOPICS.find((t) => t.id === id);
const later = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Rahmen ----------

function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 780);
  document.documentElement.style.setProperty('--s', s.toFixed(4));
}

function setTitle(title, right = '') {
  $('#title').textContent = title;
  $('#title-right').textContent = right;
}

// Hinweise in der Fußleiste: *X* = Taste X (fett gelb)
function setHint(text) { $('#f-hint').innerHTML = esc(text).replace(/\*([^*]+)\*/g, '<b class="hk">$1</b>'); }

function renderCmd() {
  const mask = state.view === 'selfdestruct' && /code/.test(state.sd?.step || '');
  $('#cmd').textContent = mask ? '*'.repeat(state.buffer.length) : state.buffer;
}

function initChromeText() {
  $('#info-model').textContent = `${CONFIG.computer}  ${CONFIG.stationCode}`;
  $('#info-code').textContent = CONFIG.infoCode ?? '';
  $('#info-date').textContent = CONFIG.date ?? '';
}

function initChrome() {
  $('#info-logo').innerHTML = wyLogo();
  initChromeText();
  updateFlags();
  updateUser();
}

function updateUser() {
  $('#f-user').textContent = state.user ? state.user.name : 'NICHT ANGEMELDET';
  const lv = $('#f-level');
  lv.textContent = state.user?.mainframe ? 'ROT·MF' : levelName();
  lv.className = levelClass();
}

function updateFlags() {
  document.body.classList.toggle('muted', !sound.enabled);
}

// ---------- Schreibmaschinen-Effekt ----------

function typewrite(root, cps = 320) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const full = nodes.map((n) => n.nodeValue);
  nodes.forEach((n) => { n.nodeValue = ''; });

  return new Promise((resolve) => {
    let i = 0;
    let pos = 0;
    let last = performance.now();
    let raf = 0;
    const done = () => {
      cancelAnimationFrame(raf);
      if (state.typing === job) state.typing = null;
      resolve();
    };
    const job = {
      finish() { nodes.forEach((n, k) => { n.nodeValue = full[k]; }); done(); },
      cancel: done,
    };
    const step = (t) => {
      let budget = Math.max(1, Math.round(((t - last) * cps) / 1000));
      last = t;
      while (budget > 0 && i < nodes.length) {
        const take = Math.min(full[i].length - pos, budget);
        pos += take;
        budget -= take;
        nodes[i].nodeValue = full[i].slice(0, pos);
        if (pos >= full[i].length) { i++; pos = 0; }
      }
      sound.tick();
      if (i >= nodes.length) return done();
      raf = requestAnimationFrame(step);
    };
    state.typing = job;
    raf = requestAnimationFrame(step);
  });
}

// ---------- Ansichten ----------

function leave() {
  if (state.typing) state.typing.cancel();
  if (state.map) state.map.destroy();
  state.map = null;
  if (state.chat) state.chat.timers.forEach(clearTimeout);
  state.chat = null;
  state.sd = null;
}

function showMenu() {
  leave();
  state.view = 'menu';
  setTitle('HAUPTMENÜ', '1A ◂');
  setHint('↑↓ WÄHLEN · BUCHSTABE ODER FRAGE EINTIPPEN');
  const menu = visibleMenu();
  if (state.menuIndex >= menu.length) state.menuIndex = 0;
  view.innerHTML = `
    <div class="menu">
      <section class="menu-main">
        <p class="greet">${esc(CONFIG.greeting)}</p>
        <ul class="menu-list${menu.length > 10 ? ' long' : ''}">
          ${menu.map((m, i) => `<li data-i="${i}" class="${m.topic === 'selbstzerstoerung' ? 'danger' : ''}"><span class="k">[${m.key}]</span><span>${esc(m.label)}</span></li>`).join('')}
        </ul>
      </section>
      <aside class="menu-side">
        <div class="readouts user">
          <div class="ro col"><span class="dim">AKTUELLER BENUTZER</span><span>${esc(state.user?.name || '–')}</span></div>
          <div class="ro col switch" title="Zugang wechseln"><span class="dim">ZUGANGSSTUFE <span class="ro-key"><b>W</b> WECHSELN</span></span><span class="${levelClass()}">${esc(levelName())}</span></div>
        </div>
        ${canSee('orange') ? `<div class="readouts station">
          ${CONFIG.readouts.map((r) => `<div class="ro"><span>${esc(r.label)}</span><span class="${r.state}">${esc(r.value)}</span></div>`).join('')}
        </div>` : ''}
        ${state.destruct ? '<div class="ro crit sd-mini"><span>SELBSTZERSTÖRUNG</span><span class="sd-clock"></span></div>' : ''}
      </aside>
    </div>`;
  $('.ro.switch', view)?.addEventListener('click', changeAccess);
  view.querySelectorAll('.menu-list li').forEach((li) => {
    li.addEventListener('mouseenter', () => { state.menuIndex = +li.dataset.i; markMenu(); });
    li.addEventListener('click', () => openMenu(+li.dataset.i));
  });
  markMenu();
}

function markMenu() {
  view.querySelectorAll('.menu-list li').forEach((li, i) => li.classList.toggle('sel', i === state.menuIndex));
}

function openMenu(i) {
  const m = visibleMenu()[i];
  if (!m) return;
  state.menuIndex = i;
  sound.confirm();
  openTopic(topicById(m.topic));
}

function openTopic(topic) {
  if (!topic) return showMenu();
  if (!canSee(topic.access)) return showDenied(topic);
  if (topic.view === 'report') showReport(topic);
  else if (topic.view === 'commlog') showCommlog();
  else if (topic.view === 'systems') showSystems();
  else if (topic.view === 'selfdestruct') showSelfDestruct();
  else if (topic.view === 'map') showMap(topic);
  else if (topic.view === 'interkom') showInterkom();
  else if (topic.view === 'help') showHelp();
  else if (topic.view === 'damage') showDamage(topic);
}

function blockHtml(b) {
  switch (b.type) {
    case 'text':
      return `<p>${colorize(b.text)}</p>`;
    case 'alert':
      return `<p class="alert"><span class="blink">▲</span> ${colorize(b.text)}</p>`;
    case 'meter': {
      const n = 24;
      const on = Math.round((Math.max(0, Math.min(100, b.value)) / 100) * n);
      const st = b.state || 'ok';
      return `<div class="meter"><span class="lbl">${esc(b.label)}</span><span class="bar ${st}">${'▮'.repeat(on)}<span class="off">${'▮'.repeat(n - on)}</span></span><span class="val ${st}">${esc(b.display ?? `${b.value}%`)}</span></div>`;
    }
    case 'table':
      return `<table class="tbl"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${colorize(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    default:
      return '';
  }
}

function showReport(topic) {
  leave();
  state.view = 'report';
  setTitle(topic.title, '2B ◂');
  setHint('↑↓ BLÄTTERN · ESC MENÜ');
  view.innerHTML = `<div class="report">
      <div class="report-head"><span>REF ${topic.id.toUpperCase().slice(0, 4)}-${pad(topic.title.length * 37, 4)} // ${esc(CONFIG.stationCode)}</span></div>
      ${topic.blocks.map(blockHtml).join('')}
    </div>`;
  typewrite(view.firstElementChild);
}

// Schadensbericht: Fälle aus dem Editor plus alle Räume mit Status aus dem Karten-Editor
function showDamage(topic) {
  leave();
  state.view = 'report';
  const dmg = topic.damage || {};
  const lv = STATION.levels[0];
  const layer = loadLayer(lv.id, lv.layer);
  const level = lv.plan;
  const roomById = (id) => level.rooms.find((r) => r.id === id);
  const rows = [];
  const covered = new Set();
  for (const c of dmg.cases || []) {
    const room = c.room && roomById(c.room);
    const status = room ? layer.rooms[room.id]?.status || '' : c.status || '';
    if (room) covered.add(room.id);
    rows.push({ name: c.title || (room ? roomName(level, room, layer) : '–'), status, text: c.text || '' });
  }
  for (const room of level.rooms) {
    const st = layer.rooms[room.id]?.status;
    if (st && !covered.has(room.id)) rows.push({ name: roomName(level, room, layer), status: st, text: layer.rooms[room.id]?.info || '' });
  }
  const active = rows.filter((r) => r.status);
  const hull = Number(dmg.hull);
  const blocks = [];
  if (dmg.intro) blocks.push({ type: 'text', text: `${dmg.intro} ${active.length} BEREICH${active.length === 1 ? '' : 'E'} MIT AUFFÄLLIGKEITEN.` });
  if (!rows.length && dmg.none) blocks.push({ type: 'text', text: dmg.none });
  rows.filter((r) => ['damage', 'offline', 'sealed'].includes(r.status) && r.text)
    .forEach((r) => blocks.push({ type: 'alert', text: `${r.name}: ${r.text}` }));
  if (rows.length) {
    blocks.push({ type: 'table', head: ['BEREICH', 'STATUS', 'MELDUNG'], rows: rows.map((r) => [r.name, STATUS[r.status] || STATUS[''], r.text || '–']) });
  }
  if (Number.isFinite(hull) && dmg.hullLabel) blocks.push({ type: 'meter', label: dmg.hullLabel, value: hull, state: hull < 50 ? 'crit' : hull < 90 ? 'warn' : '' });
  if (dmg.recommendation) blocks.push({ type: 'text', text: `EMPFEHLUNG: ${dmg.recommendation}` });
  showReport({ ...topic, blocks });
}

function showHelp() {
  leave();
  state.view = 'help';
  setTitle('HILFE', '0H ◂');
  setHint('ESC MENÜ');
  const examples = TOPICS.filter((t) => t.example && canSee(t.access));
  view.innerHTML = `<div class="report help">
      <p>STELLEN SIE IHRE FRAGE IN NORMALER SPRACHE ODER WÄHLEN SIE EINEN MENÜPUNKT PER BUCHSTABE + ENTER.</p>
      <p class="dim">VERFÜGBARE INFORMATIONSKATEGORIEN:</p>
      <div class="help-grid">
        ${examples.map((t) => `<div class="help-item"><span class="hl">${esc(t.title)}</span><span class="dim">z.B. „${esc(t.example)}“</span></div>`).join('')}
      </div>
      <p class="dim">ANGEMELDET: ${esc(state.user?.name || '–')} // ZUGANGSSTUFE ${esc(levelName())} · W ZUGANG WECHSELN · X ABMELDEN.</p>
      <p class="dim">TASTEN: ↑↓ AUSWAHL · ⏎ BESTÄTIGEN · ESC ZURÜCK · F9 TON AN/AUS · F10 RÖHRENEFFEKT · F11 VOLLBILD</p>
    </div>`;
  typewrite(view.firstElementChild, 600);
}

function showUnknown(raw) {
  leave();
  state.view = 'unknown';
  setTitle('ANFRAGE UNBEKANNT', 'ERR ◂');
  setHint('ESC MENÜ · ODER NEUE FRAGE');
  sound.error();
  view.innerHTML = `<div class="report">
      <p class="dim">&gt; ANFRAGE: „${esc(raw.toUpperCase())}“</p>
      <p class="warn">ANFRAGE KONNTE KEINER DATENBANK ZUGEORDNET WERDEN.</p>
      <p>BITTE FORMULIEREN SIE IHRE ANFRAGE NEU ODER GEBEN SIE <span class="hl">HILFE</span> EIN.</p>
    </div>`;
  typewrite(view.firstElementChild);
}

function showDenied(topic) {
  leave();
  state.view = 'denied';
  setTitle('ZUGRIFF VERWEIGERT', 'SEC ◂');
  setHint('ESC MENÜ · ODER NEUE FRAGE');
  sound.error();
  const need = topic.access === 'mainframe' ? 'NUR AM MAINFRAME (COMPUTERRAUM) VERFÜGBAR.' : `ZUGANGSSTUFE ${ACCESS[topic.access] || ''} ERFORDERLICH.`;
  view.innerHTML = `<div class="report">
      <p class="dim">&gt; ${esc(topic.title)}</p>
      <p class="crit">ZUGRIFF VERWEIGERT.</p>
      <p>${esc(need)}</p>
      <p class="dim">IHRE ZUGANGSSTUFE: <span class="${levelClass()}">${esc(levelName())}</span></p>
    </div>`;
  typewrite(view.firstElementChild);
}

function showMap(topic) {
  leave();
  state.view = 'map';
  view.innerHTML = '<div class="map"></div>';
  state.map = new MapView(view.firstElementChild, {
    config: CONFIG,
    station: STATION,
    sound,
    onLevel: (i, info) => {
      setTitle(info.title, `R${i + 1} ◂`);
      if (info.plan) setHint('←→ RAUM · RAUM-ID EINTIPPEN · ↑ ZURÜCK · STRG+PFEILE BEWEGEN · +/# ZOOM · ESC');
      else setHint('↓/↑ WEITER/ZURÜCK · STRG+PFEILE BEWEGEN · +/# ZOOM · ESC MENÜ');
    },
  });
  state.map.show(LEVELS.indexOf(topic.level));
}

// ---------- Interkom ----------

function showInterkom() {
  leave();
  state.view = 'interkom';
  setTitle('INTERKOMM', '3C ◂');
  setHint('↑↓ WÄHLEN · *A* ANRUFEN · *B* NACHRICHT · ESC MENÜ');
  view.innerHTML = `<div class="ik">
      <ul class="ik-list">${PERSONNEL.map((p, i) => `<li data-i="${i}"><span class="k">${pad(i + 1)}</span><span>${esc(p.name)}</span></li>`).join('')}</ul>
      <section class="ik-profile"></section>
    </div>`;
  view.querySelectorAll('.ik-list li').forEach((li) => {
    li.addEventListener('click', () => { state.personIndex = +li.dataset.i; renderProfile(); });
  });
  renderProfile();
}

function portrait(p) {
  if (p.image) return `<img src="${esc(p.image)}" alt="">`;
  return `<svg viewBox="0 0 100 120" class="noimg"><circle cx="50" cy="44" r="21"/><path d="M12 120 C12 88 30 76 50 76 C70 76 88 88 88 120"/></svg>
    <span class="noimg-t">NO IMAGE DATA</span>`;
}

function renderProfile() {
  view.querySelectorAll('.ik-list li').forEach((li, i) => li.classList.toggle('sel', i === state.personIndex));
  const p = PERSONNEL[state.personIndex];
  $('.ik-profile', view).innerHTML = `
    <div class="portrait">${portrait(p)}</div>
    <div class="pdata">
      <div class="prow"><span class="dim">NAME</span><span>${esc(p.name)}</span></div>
      <div class="prow"><span class="dim">FUNKTION</span><span>${esc(p.role)}</span></div>
      <div class="prow"><span class="dim">STANDORT</span><span>${colorize(p.location)}</span></div>
      <div class="prow"><span class="dim">STATUS</span><span class="${p.available ? 'mint' : 'crit'}">${p.available ? 'VERFÜGBAR' : 'NICHT ERREICHBAR'}</span></div>
      <div class="pactions">
        <span class="act" data-a="call"><span class="k">[A]</span> ANRUFEN</span>
        <span class="act" data-a="message"><span class="k">[B]</span> NACHRICHT</span>
      </div>
    </div>`;
  view.querySelectorAll('.act').forEach((a) => a.addEventListener('click', () => startChat(a.dataset.a)));
}

function chatLine(cls, html) {
  const log = $('.chat-log', view);
  if (!log) return null;
  log.insertAdjacentHTML('beforeend', `<div class="cl ${cls}">${html}</div>`);
  log.scrollTop = log.scrollHeight;
  return log.lastElementChild;
}

async function startChat(mode) {
  const p = PERSONNEL[state.personIndex];
  leave();
  state.view = 'chat';
  const chat = { person: p, mode, timers: [], connected: false };
  state.chat = chat;
  setTitle(mode === 'call' ? 'INTERKOMM // VERBINDUNG' : 'INTERKOMM // NACHRICHT', '3D ◂');
  setHint('TEXT EINTIPPEN UND SENDEN · ESC TRENNEN');
  view.innerHTML = `<div class="chat">
      <div class="chat-head">
        <div class="mini-portrait">${portrait(p)}</div>
        <div><div class="chat-name">${esc(p.name)}</div><div class="dim">${esc(p.role)} // ${colorize(p.location)}</div></div>
      </div>
      <div class="chat-log"></div>
      <div class="chat-note">PROTOTYP: ANTWORTEN WERDEN SIMULIERT</div>
    </div>`;

  if (mode === 'message') {
    chatLine('sys', `NACHRICHT AN ${esc(p.name)}. TEXT EINGEBEN UND MIT ⏎ SENDEN.`);
    chat.connected = true;
    return;
  }

  const line = chatLine('sys', `VERBINDUNG ZU ${esc(p.name)} WIRD AUFGEBAUT <span class="dots"></span>`);
  const dots = $('.dots', line);
  for (let i = 0; i < 3; i++) {
    sound.ring();
    for (let d = 1; d <= 3; d++) {
      if (state.chat !== chat) return;
      dots.textContent = '▮'.repeat(d) + '▯'.repeat(3 - d);
      await later(300);
    }
  }
  if (state.chat !== chat) return;
  if (!p.available) {
    sound.error();
    chatLine('crit', 'KEINE ANTWORT. TEILNEHMER NICHT ERREICHBAR.');
    chatLine('sys', 'ESC FÜR ZURÜCK.');
    return;
  }
  sound.confirm();
  chatLine('ok', '■ VERBINDUNG STEHT');
  chat.connected = true;
}

function sendChat(text) {
  const chat = state.chat;
  if (!chat || !chat.connected) return;
  sound.beep();
  chatLine('out', `<span class="who">SIE ▸</span> ${esc(text.toUpperCase())}`);
  if (chat.mode === 'message') {
    chatLine('sys', 'NACHRICHT ÜBERMITTELT.');
    return;
  }
  const surname = chat.person.name.split(' ').pop();
  chat.timers.push(setTimeout(() => {
    if (state.chat !== chat) return;
    const incoming = chatLine('sys', 'EINGEHENDE ÜBERTRAGUNG ▮▮▯');
    chat.timers.push(setTimeout(() => {
      if (state.chat !== chat) return;
      incoming.remove();
      const reply = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)].replace('{name}', chat.person.name);
      const line = chatLine('in', `<span class="who">${esc(surname)} ◂</span> <span class="msg">${esc(reply)}</span>`);
      sound.confirm();
      typewrite($('.msg', line), 90);
    }, 1600));
  }, 700));
}

// ---------- Anmeldung ----------

const LOGIN_ID = [['guest', 'GASTZUGANG'], ['mainframe', 'DIREKTZUGANG MAINFRAME (COMPUTERRAUM)']];
const LOGIN_LEVEL = [['green', 'GRÜN'], ['orange', 'ORANGE'], ['red', 'ROT'], ['mainframe', 'DIREKTZUGANG MAINFRAME (COMPUTERRAUM)']];

function loginOptions() { return state.login?.step === 'level' ? LOGIN_LEVEL : LOGIN_ID; }

function showLogin(step = 'id', name = '', change = false) {
  leave();
  state.view = 'login';
  state.login = { step, name, index: 0, change };
  setTitle(change ? 'ZUGANG WECHSELN' : 'IDENTIFIKATION', 'ID ◂');
  const opts = loginOptions();
  const cls = { green: 'lvl-green', orange: 'lvl-orange', red: 'lvl-red', mainframe: 'lvl-red' };
  if (step === 'id') setHint('NAME EINTIPPEN · ODER *A* GAST · *B* MAINFRAME');
  else setHint(`ZUGANGSSTUFE *A* *B* *C* *D* WÄHLEN · ESC ${change ? 'ABBRECHEN' : 'ZURÜCK'}`);
  view.innerHTML = `<div class="login">
      <div class="login-box">
        <div class="login-head"><span>${esc(CONFIG.company)} // ZUGANGSKONTROLLE</span><span>${esc(CONFIG.stationCode)} ${esc(CONFIG.terminalId)}</span></div>
        <div class="login-body">
        ${step === 'id' ? `
          <p>${esc(CONFIG.computer)} // BITTE IDENTIFIZIEREN SIE SICH.</p>
          <p class="dim">NAME EINTIPPEN UND MIT ⏎ BESTÄTIGEN – ODER:</p>` : `
          <p>BENUTZER: <span class="hl">${esc(name)}</span></p>
          <p class="dim">ZUGANGSSTUFE WÄHLEN:</p>`}
          <ul class="menu-list login-list">
            ${opts.map(([k, t], i) => `<li data-i="${i}"><span class="k">[${KEYS[i]}]</span><span class="${step === 'level' ? cls[k] : ''}">${esc(t)}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`;
  view.querySelectorAll('.login-list li').forEach((li) => {
    li.addEventListener('mouseenter', () => { state.login.index = +li.dataset.i; markLogin(); });
    li.addEventListener('click', () => pickLogin(+li.dataset.i));
  });
  markLogin();
  typewrite($('.login-body', view), 500);
}

function markLogin() {
  view.querySelectorAll('.login-list li').forEach((li, i) => li.classList.toggle('sel', i === state.login.index));
}

function pickLogin(i) {
  const opt = loginOptions()[i];
  if (!opt) return;
  const [k] = opt;
  const { step, name } = state.login;
  if (step === 'id' && k === 'guest') return grant({ name: 'GAST', level: 'green', mainframe: false });
  if (k === 'mainframe') return grant({ name: step === 'level' ? name : 'MAINFRAME-KONSOLE', level: 'red', mainframe: true });
  if (step === 'level') grant({ name, level: k, mainframe: false });
}

async function grant(user) {
  state.user = user;
  state.menuIndex = 0;
  updateUser();
  sound.confirm();
  leave();
  state.view = 'granted';
  state.busy = true;
  view.innerHTML = `<div class="login"><div class="login-box"><div class="login-body">
      <p>IDENTITÄT REGISTRIERT: <span class="hl">${esc(user.name)}</span></p>
      <p>ZUGANGSSTUFE: <span class="${levelClass()}">${esc(levelName())}</span></p>
      <p class="mint">ZUGANG GEWÄHRT.</p>
    </div></div></div>`;
  await typewrite($('.login-body', view), 400);
  await later(700);
  state.busy = false;
  showMenu();
}

// W: Zugangsstufe wechseln (Name bleibt)
function changeAccess() {
  if (!state.user) return;
  sound.confirm();
  showLogin('level', state.user.name, true);
}

// X: Terminal verlassen – zurück zum allerersten Bildschirm
function logout() {
  sound.beep();
  setTimeout(() => location.reload(), 120);
}

// ---------- KOMMLOG ----------

const visibleLog = () => COMMLOG.map((m, i) => ({ m, i })).filter(({ m }) => canSee(m.access || 'orange'));
const sentLabel = (m) => (m.sent === false ? '<span class="crit">NICHT VERSENDET</span>' : '<span class="mint">VERSENDET</span>');
const accessLabel = (a) => `<span class="lvl-${a === 'mainframe' ? 'red' : a || 'orange'}">${esc(ACCESS[a] || ACCESS.orange)}</span>`;

function showCommlog() {
  leave();
  state.view = 'commlog';
  setTitle('KOMMLOG // STATIONSKOMMUNIKATION', '4K ◂');
  setHint('↑↓ NACHRICHT WÄHLEN UND ÖFFNEN · ESC MENÜ');
  const list = visibleLog();
  if (state.logIndex >= list.length) state.logIndex = 0;
  view.innerHTML = `<div class="log">
      <div class="report-head"><span>${list.length} EINTRÄGE // FREIGABE ${esc(levelName())}</span></div>
      ${list.length ? `<table class="tbl log-tbl">
        <colgroup><col style="width:125px"><col style="width:80px"><col style="width:200px"><col style="width:200px"><col><col style="width:105px"><col style="width:180px"></colgroup>
        <thead><tr><th>DATUM</th><th>ZEIT</th><th>SENDER</th><th>EMPFÄNGER</th><th>BETREFF</th><th>ZUGANG</th><th>STATUS</th></tr></thead>
        <tbody>${list.map(({ m }, i) => `<tr data-i="${i}"><td>${esc(m.date)}</td><td>${esc(m.time)}</td><td>${esc(m.from)}</td><td>${esc(m.to)}</td><td>${esc(m.subject)}</td><td>${accessLabel(m.access)}</td><td>${sentLabel(m)}</td></tr>`).join('')}</tbody>
      </table>` : '<p class="dim">KEINE EINTRÄGE FÜR IHRE ZUGANGSSTUFE.</p>'}
    </div>`;
  view.querySelectorAll('.log-tbl tbody tr').forEach((tr) => {
    tr.addEventListener('mouseenter', () => { state.logIndex = +tr.dataset.i; markLog(); });
    tr.addEventListener('click', () => openMessage(+tr.dataset.i));
  });
  markLog();
}

function markLog() {
  view.querySelectorAll('.log-tbl tbody tr').forEach((tr, i) => tr.classList.toggle('sel', i === state.logIndex));
  view.querySelector('.log-tbl tr.sel')?.scrollIntoView({ block: 'nearest' });
}

function openMessage(i) {
  const entry = visibleLog()[i];
  if (!entry) return;
  const { m } = entry;
  state.logIndex = i;
  sound.confirm();
  leave();
  state.view = 'message';
  setTitle('KOMMLOG // NACHRICHT', '4M ◂');
  setHint('↑↓ BLÄTTERN · ESC LISTE');
  const person = PERSONNEL.find((p) => p.name && normalize(p.name) === normalize(m.from || ''));
  const image = m.image || person?.image || '';
  view.innerHTML = `<div class="msg-view">
      <div class="portrait">${portrait({ image })}</div>
      <div class="msg-body report">
        <div class="pdata">
          <div class="prow"><span class="dim">VON</span><span>${esc(m.from)}</span></div>
          <div class="prow"><span class="dim">AN</span><span>${esc(m.to)}</span></div>
          <div class="prow"><span class="dim">DATUM</span><span>${esc(m.date)} // ${esc(m.time)}</span></div>
          <div class="prow"><span class="dim">ZUGANG</span>${accessLabel(m.access)}</div>
          <div class="prow"><span class="dim">STATUS</span>${sentLabel(m)}</div>
        </div>
        <p class="msg-subj">BETREFF: ${esc(m.subject)}</p>
        <div class="msg-text">${String(m.text || '').split('\n').map((l) => `<p>${colorize(l)}</p>`).join('')}</div>
      </div>
    </div>`;
  typewrite($('.msg-text', view), 260);
}

// ---------- ZUGRIFF STATIONSSYSTEME ----------

const SYS_COLS = 4;

function showSystems() {
  leave();
  state.view = 'systems';
  setTitle('ZUGRIFF STATIONSSYSTEME', '5S ◂');
  setHint('PFEILTASTEN WÄHLEN · ESC MENÜ');
  if (state.sysIndex >= SYSTEMS.length) state.sysIndex = 0;
  view.innerHTML = `<div class="sys">
      <div class="report-head"><span>STATIONSSYSTEME // FERNZUGRIFF</span><span>BENUTZER ${esc(state.user?.name || '–')}</span></div>
      <div class="sys-grid">${SYSTEMS.map((n, i) => `<button class="sys-btn" data-i="${i}"><span class="sys-no">${pad(i + 1)}</span><span>${esc(n)}</span></button>`).join('')}</div>
      <p class="sys-msg dim">SYSTEM WÄHLEN.</p>
    </div>`;
  view.querySelectorAll('.sys-btn').forEach((b) => {
    b.addEventListener('mouseenter', () => { state.sysIndex = +b.dataset.i; markSys(); });
    b.addEventListener('click', () => { state.sysIndex = +b.dataset.i; markSys(); activateSystem(); });
  });
  markSys();
}

function markSys() {
  view.querySelectorAll('.sys-btn').forEach((b, i) => b.classList.toggle('sel', i === state.sysIndex));
}

function moveSys(dx, dy) {
  const n = SYSTEMS.length;
  if (!n) return;
  let i = state.sysIndex + dx + dy * SYS_COLS;
  if (i < 0) i = (i + n) % n;
  if (i >= n) i %= n;
  state.sysIndex = i;
  markSys();
  sound.click();
}

function activateSystem() {
  const name = SYSTEMS[state.sysIndex];
  if (!name) return;
  sound.error();
  const msg = $('.sys-msg', view);
  msg.className = 'sys-msg';
  msg.innerHTML = `&gt; ${esc(name)}: <span class="warn">FERNSTEUERUNG DERZEIT NICHT VERFÜGBAR.</span>`;
  typewrite(msg, 300);
}

// ---------- SELBSTZERSTÖRUNG ----------

function showSelfDestruct() {
  leave();
  state.view = 'selfdestruct';
  setTitle('SELBSTZERSTÖRUNG', 'SD ◂');
  setHint('EINGABE TIPPEN · ESC MENÜ');
  const sd = { step: 'code', printing: false };
  state.sd = sd;
  view.innerHTML = `<div class="sd">
      <div class="sd-win">
        <div class="sd-title"><span>MAINFRAME // ${esc(CONFIG.computer)} // REACTOR CONTROL</span><span>${esc(CONFIG.stationCode)}</span></div>
        <div class="sd-log"></div>
      </div>
      <div class="sd-count" hidden><div class="sd-label"></div><div class="sd-clock big"></div></div>
    </div>`;
  if (state.destruct) {
    sd.step = 'running';
    showCountdown();
    sdPrint([['SELBSTZERSTÖRUNG LÄUFT.', 'crit'], ['ZUM ABBRECHEN „ABBRUCH“ EINGEBEN.', 'dim']]);
  } else {
    sdPrint([...(SELFDESTRUCT.intro || []).map((l) => [l, 'warn']), [SELFDESTRUCT.codePrompt, '']]);
  }
}

async function sdPrint(lines) {
  const sd = state.sd;
  sd.printing = true;
  const log = $('.sd-log', view);
  for (const [text, cls] of lines) {
    if (state.sd !== sd) return false;
    const el = document.createElement('div');
    el.className = `sd-line ${cls || ''}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    await typewrite(el, 160);
    await later(140);
  }
  if (state.sd !== sd) return false;
  sd.printing = false;
  return true;
}

function sdEcho(text) {
  const log = $('.sd-log', view);
  log.insertAdjacentHTML('beforeend', `<div class="sd-line in">&gt; ${esc(text)}</div>`);
  log.scrollTop = log.scrollHeight;
}

async function sdInput(raw) {
  const sd = state.sd;
  if (!sd || sd.printing || !raw) return;
  const yes = ['ja', 'j', 'yes', 'y'].includes(normalize(raw));
  const no = ['nein', 'n', 'no'].includes(normalize(raw));
  sound.beep();
  if (sd.step === 'code' || sd.step === 'abort-code') {
    sdEcho('*'.repeat(Math.max(4, raw.length)));
    if (sd.step === 'abort-code') {
      stopDestruct();
      sd.step = 'aborted';
      sound.confirm();
      await sdPrint([[SELFDESTRUCT.codeOk, 'mint'], ['SELBSTZERSTÖRUNG ABGEBROCHEN. REAKTORKERN WIRD STABILISIERT.', 'mint']]);
      return;
    }
    sd.step = 'confirm';
    sound.confirm();
    await sdPrint([[SELFDESTRUCT.codeOk, 'mint'], [SELFDESTRUCT.confirm, 'warn']]);
    return;
  }
  if (sd.step === 'confirm') {
    sdEcho(raw.toUpperCase());
    if (yes) {
      sd.step = 'running';
      sound.error();
      startDestruct();
      showCountdown();
      await sdPrint([...(SELFDESTRUCT.sequence || []).map((l) => [l, 'crit']), ['ZUM ABBRECHEN „ABBRUCH“ EINGEBEN.', 'dim']]);
    } else if (no) {
      sd.step = 'aborted';
      await sdPrint([[SELFDESTRUCT.cancelled, 'dim']]);
    } else {
      await sdPrint([['BITTE MIT JA ODER NEIN ANTWORTEN.', 'dim']]);
    }
    return;
  }
  if (sd.step === 'running') {
    sdEcho(raw.toUpperCase());
    if (/^abbr/.test(normalize(raw)) || normalize(raw) === 'abort') {
      sd.step = 'abort-code';
      await sdPrint([[SELFDESTRUCT.codePrompt, '']]);
    } else {
      await sdPrint([['UNGÜLTIGE EINGABE.', 'dim']]);
    }
  }
}

function showCountdown() {
  const box = $('.sd-count', view);
  if (!box) return;
  box.hidden = false;
  $('.sd-label', box).textContent = SELFDESTRUCT.countdownLabel || '';
  tickDestruct();
}

const fmtLeft = (ms) => {
  const t = Math.max(0, ms) / 1000;
  return `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t * 100) % 100))}`;
};

function startDestruct() {
  if (state.destruct) return;
  const min = Number(SELFDESTRUCT.minutes) > 0 ? Number(SELFDESTRUCT.minutes) : 10;
  const d = { end: Date.now() + min * 60000, lastAlarm: 0 };
  d.timer = setInterval(tickDestruct, 50);
  state.destruct = d;
  document.body.classList.add('destruct');
}

function stopDestruct() {
  if (!state.destruct) return;
  clearInterval(state.destruct.timer);
  state.destruct = null;
  document.body.classList.remove('destruct');
  $('#f-sd').hidden = true;
}

function tickDestruct() {
  const d = state.destruct;
  if (!d) return;
  const left = d.end - Date.now();
  const text = fmtLeft(left);
  document.querySelectorAll('.sd-clock').forEach((n) => { n.textContent = text; });
  const f = $('#f-sd');
  f.hidden = false;
  f.textContent = `SD T-${text.slice(0, 5)}`;
  if (Date.now() - d.lastAlarm > 4000) { d.lastAlarm = Date.now(); sound.alarm(); }
  if (left <= 0) detonate();
}

function detonate() {
  clearInterval(state.destruct.timer);
  state.ready = false;
  leave();
  sound.boom();
  document.body.classList.add('detonated');
  const over = document.createElement('div');
  over.className = 'detonation';
  over.innerHTML = `<div class="det-flash"></div><div class="det-text"><span class="blink">${esc(SELFDESTRUCT.final || 'SIGNAL VERLOREN')}</span></div>`;
  $('.screen').appendChild(over);
}

// ---------- Freie Anfrage ----------

// Kandidaten für die freie Eingabe: alle Kategorien plus ihre zusätzlichen Infos
function candidates() {
  const list = [];
  for (const t of TOPICS) {
    list.push(t);
    (t.infos || []).forEach((info) => {
      const qWords = (info.questions || []).flatMap((q) => normalize(q).split(' ')).filter((w) => w.length >= 5);
      list.push({ keywords: info.keywords || [], weak: qWords, questions: info.questions || [], bonus: 0.5, topic: t, info });
    });
  }
  return list;
}

function showInfo(topic, info) {
  const access = info.access || topic.access;
  if (!canSee(access)) return showDenied({ title: `${topic.title} // ${info.title}`, access });
  showReport({ id: topic.id, title: `${topic.title} // ${info.title || 'INFO'}`, blocks: info.blocks || [] });
}

async function query(raw) {
  const hit = matchTopic(raw, candidates());
  leave();
  state.busy = true;
  state.view = 'processing';
  view.innerHTML = `<div class="report">
      <p class="dim">&gt; ANFRAGE: „${esc(raw.toUpperCase())}“</p>
      <p>VERARBEITE ANFRAGE <span class="proc">▯▯▯</span></p>
    </div>`;
  const proc = $('.proc', view);
  for (let i = 1; i <= 3; i++) {
    await later(200);
    proc.textContent = '▮'.repeat(i) + '▯'.repeat(3 - i);
    sound.tick();
  }
  await later(150);
  state.busy = false;
  if (!hit) return showUnknown(raw);
  sound.confirm();
  if (hit.topic.info) return showInfo(hit.topic.topic, hit.topic.info);
  openTopic(hit.topic);
}

// ---------- Tastatur ----------

function back() {
  if (state.view === 'login') {
    if (state.login?.change) { sound.beep(); showMenu(); return; }
    if (state.login?.step === 'level') { sound.beep(); showLogin('id'); }
    return;
  }
  if (state.view === 'granted') return;
  sound.beep();
  if (state.view === 'message') return showCommlog();
  if (state.view === 'chat') {
    const connected = state.chat?.connected && state.chat.mode === 'call';
    if (connected) chatLine('crit', 'VERBINDUNG GETRENNT.');
    const chat = state.chat;
    setTimeout(() => { if (state.chat === chat) showInterkom(); }, connected ? 500 : 0);
    return;
  }
  if (state.view !== 'menu') showMenu();
}

function nav(dir) {
  if (state.view === 'menu') {
    const n = visibleMenu().length || 1;
    state.menuIndex = (state.menuIndex + dir + n) % n;
    markMenu();
    sound.click();
  } else if (state.view === 'login') {
    const n = loginOptions().length;
    state.login.index = (state.login.index + dir + n) % n;
    markLogin();
    sound.click();
  } else if (state.view === 'commlog') {
    const n = visibleLog().length || 1;
    state.logIndex = (state.logIndex + dir + n) % n;
    markLog();
    sound.click();
  } else if (state.view === 'systems') {
    moveSys(0, dir);
  } else if (state.view === 'interkom') {
    state.personIndex = (state.personIndex + dir + PERSONNEL.length) % PERSONNEL.length;
    renderProfile();
    sound.click();
  } else if (state.view === 'map' && state.map) {
    if (dir < 0) state.map.ascend();
    else state.map.descend();
  } else {
    const scroller = $('.report', view) || $('.chat-log', view) || $('.sd-log', view);
    if (scroller) scroller.scrollTop += dir * 80;
  }
}

function submit() {
  const raw = state.buffer.trim();
  state.buffer = '';
  renderCmd();

  // W / X: von überall Zugang wechseln bzw. abmelden (nicht während einer Code-Eingabe)
  const codeEntry = state.view === 'selfdestruct' && /code/.test(state.sd?.step || '');
  if (state.user && !codeEntry && !(state.view === 'login' && !state.login?.change)) {
    const cmd = normalize(raw);
    if (cmd === 'x' || ['abmelden', 'logout', 'abmeldung', 'log out'].includes(cmd)) return logout();
    if (cmd === 'w' && state.view !== 'login') return changeAccess();
  }
  if (state.view === 'chat') {
    if (raw) sendChat(raw);
    return;
  }
  if (state.view === 'login') {
    const lower1 = raw.toLowerCase();
    const opts = loginOptions();
    if (!raw) return pickLogin(state.login.index);
    if (lower1.length === 1 && KEYS.slice(0, opts.length).toLowerCase().includes(lower1)) return pickLogin(KEYS.toLowerCase().indexOf(lower1));
    if (state.login.step === 'id') {
      sound.confirm();
      return showLogin('level', raw.toUpperCase().slice(0, 32));
    }
    sound.error();
    return;
  }
  if (state.view === 'selfdestruct') {
    sdInput(raw);
    return;
  }

  if (!raw) {
    if (state.view === 'menu') openMenu(state.menuIndex);
    else if (state.view === 'commlog') openMessage(state.logIndex);
    else if (state.view === 'systems') activateSystem();
    else if (state.view === 'interkom') startChat('call');
    else if (state.view === 'map') state.map.descend();
    return;
  }
  const lower = raw.toLowerCase();
  if (state.view === 'map' && state.map?.info?.plan) {
    const i = state.map.findRoom(raw);
    if (i >= 0) { state.map.focusRoom(i); return; }
  }
  if (state.view === 'map' && lower === 'a') {
    sound.confirm();
    state.map.descend();
    return;
  }
  if (state.view === 'interkom') {
    if (lower === 'a') return startChat('call');
    if (lower === 'b') return startChat('message');
    if (/^\d+$/.test(lower) && PERSONNEL[+lower - 1]) {
      state.personIndex = +lower - 1;
      renderProfile();
      return;
    }
  }
  if (/^[a-z]$/.test(lower)) {
    const i = visibleMenu().findIndex((m) => m.key.toLowerCase() === lower);
    if (i >= 0) return openMenu(i);
  }
  if (['menu', 'menue', 'hauptmenue', 'zurueck', 'back', 'exit'].includes(normalize(raw))) return showMenu();
  query(raw);
}

function onKey(e) {
  if (!state.ready) return;
  if (e.key === 'F9') { e.preventDefault(); sound.toggle(); updateFlags(); return; }
  if (e.key === 'F10') { e.preventDefault(); document.body.classList.toggle('crt'); return; }
  const onPlan = state.view === 'map' && state.map && !state.map.animating;
  if (onPlan && e.ctrlKey && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const d = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key];
    state.map.panBy(d[0], d[1]);
    return;
  }
  // '-' zoomt nur bei leerer Eingabe, damit Raum-IDs wie XENO-2 tippbar bleiben
  if (onPlan && !e.ctrlKey && !e.altKey && (e.key === '+' || e.key === '#' || (e.key === '-' && !state.buffer))) {
    e.preventDefault();
    state.map.zoomBy(e.key === '+' ? 0.75 : 1 / 0.75);
    sound.tick();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (state.busy) { e.preventDefault(); return; }
  if (state.view === 'map' && state.map?.animating && e.key !== 'Escape') {
    e.preventDefault();
    state.map.skip();
    return;
  }
  if (state.typing && e.key === 'Enter' && !state.buffer.trim()) {
    e.preventDefault();
    state.typing.finish();
    return;
  }
  switch (e.key) {
    case 'Escape': e.preventDefault(); back(); return;
    case 'ArrowUp': e.preventDefault(); nav(-1); return;
    case 'ArrowDown': e.preventDefault(); nav(1); return;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (state.view === 'map' && state.map?.info?.plan) {
        e.preventDefault();
        state.map.selectRoom(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (state.view === 'systems') {
        e.preventDefault();
        moveSys(e.key === 'ArrowLeft' ? -1 : 1, 0);
        return;
      }
      break;
    case 'Enter': e.preventDefault(); submit(); return;
    case 'Backspace':
      e.preventDefault();
      state.buffer = state.buffer.slice(0, -1);
      renderCmd();
      sound.click();
      return;
    default:
  }
  if (e.key.length === 1 && state.buffer.length < 72) {
    e.preventDefault();
    state.buffer += e.key;
    renderCmd();
    sound.click();
  }
}

// ---------- Start ----------

// Änderungen aus dem Editor (anderes Fenster) live übernehmen
addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('apollo.map.') && state.view === 'map') state.map?.redrawStation();
  if (e.key === CONTENT_KEY) {
    loadContent();
    initChromeText();
    updateUser();
    if (state.view === 'menu') showMenu();
    else if (state.view === 'commlog') showCommlog();
    else if (state.view === 'systems') showSystems();
  }
});

async function main() {
  fit();
  addEventListener('resize', fit);
  addEventListener('keydown', onKey);
  initChrome();
  await runBoot($('#boot'), CONFIG, sound);
  const app = $('#app');
  app.hidden = false;
  app.classList.add('appear');
  showLogin();
  state.ready = true;
}

main();
