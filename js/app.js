import { CONFIG, TOPICS, MENU, PERSONNEL, STATION, DEMO_REPLIES } from './data.js';
import { matchTopic, normalize } from './matcher.js';
import { sound } from './sound.js';
import { runBoot } from './boot.js';
import { MapView, LEVELS } from './maps.js';
import { wyLogo } from './logo.js';

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
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CRIT = /(?<![A-ZÄÖÜ])(KRITISCH|OFFLINE|AUSGEFALLEN|NICHT ERREICHBAR|FEHLER|UNBEKANNT)(?![A-ZÄÖÜ])/g;
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

function setHint(text) { $('#f-hint').textContent = text; }

function renderCmd() { $('#cmd').textContent = state.buffer; }

function initChrome() {
  $('#info-model').textContent = `${CONFIG.computer} ${CONFIG.model.replace(/^APOLLO\s*/, '')}`.trim();
  $('#info-logo').innerHTML = wyLogo();
  $('#info-station').textContent = CONFIG.sector;
  $('#info-code').textContent = CONFIG.star;

  const t0 = Date.now();
  let lock = 14024;
  setInterval(() => {
    const s = (Date.now() - t0) / 1000;
    $('#f-clock').textContent = `${pad(Math.floor(s / 3600))}H${pad(Math.floor(s / 60) % 60)}M ${(s % 60).toFixed(4).padStart(7, '0')}`;
    if (Math.random() < 0.3) lock += Math.floor(Math.random() * 7);
    $('#f-lock').textContent = `${pad(lock, 8)} ${pad(Math.floor(Math.random() * 100))}`;
  }, 90);
  updateFlags();
}

function updateFlags() {
  $('#f-snd').textContent = `SND ${sound.enabled ? 'ON' : 'OFF'}`;
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
}

function showMenu() {
  leave();
  state.view = 'menu';
  setTitle('HAUPTMENÜ', '1A ◂');
  setHint('↑↓ WÄHLEN · ⏎ ÖFFNEN · ODER FRAGE EINTIPPEN');
  view.innerHTML = `
    <div class="menu">
      <section class="menu-main">
        <p class="greet">${esc(CONFIG.greeting)}</p>
        <ul class="menu-list">
          ${MENU.map((m, i) => `<li data-i="${i}"><span class="k">[${m.key}]</span><span>${esc(m.label)}</span></li>`).join('')}
        </ul>
      </section>
      <aside class="menu-side">
        <div class="side-head"><span>DYNAMIC STATUS</span><span>LOCK <i class="sq"></i></span></div>
        ${radar()}
        <div class="readouts">
          ${CONFIG.readouts.map((r) => `<div class="ro"><span>${esc(r.label)}</span><span class="${r.state}">${esc(r.value)}</span></div>`).join('')}
        </div>
      </aside>
    </div>`;
  view.querySelectorAll('.menu-list li').forEach((li) => {
    li.addEventListener('mouseenter', () => { state.menuIndex = +li.dataset.i; markMenu(); });
    li.addEventListener('click', () => openMenu(+li.dataset.i));
  });
  markMenu();
}

function markMenu() {
  view.querySelectorAll('.menu-list li').forEach((li, i) => li.classList.toggle('sel', i === state.menuIndex));
}

function radar() {
  const dots = [];
  for (let x = 6; x < 200; x += 12) {
    for (let y = 6; y < 200; y += 12) {
      if (Math.hypot(x - 100, y - 100) > 88) dots.push(`<circle cx="${x}" cy="${y}" r="1"/>`);
    }
  }
  return `<svg class="radar" viewBox="0 0 200 200">
    <g class="r-dots">${dots.join('')}</g>
    <circle cx="100" cy="100" r="80" class="r-ring"/>
    <circle cx="100" cy="100" r="50" class="r-ring dim"/>
    <circle cx="100" cy="100" r="18" class="r-ring dim"/>
    <line x1="100" y1="14" x2="100" y2="186" class="r-ax"/><line x1="14" y1="100" x2="186" y2="100" class="r-ax"/>
    <g class="sweep"><path d="M100 100 L100 20 A80 80 0 0 1 156.6 43.4 Z" class="r-wedge"/><line x1="100" y1="100" x2="100" y2="20" class="r-line"/></g>
    <circle cx="138" cy="66" r="5" class="r-ring blip"/><circle cx="72" cy="128" r="4" class="r-blip b2"/><circle cx="124" cy="140" r="3.5" class="r-blip"/>
    <path d="M20 92 l8 8 l-8 8 M180 92 l-8 8 l8 8" class="r-ch"/>
  </svg>`;
}

function openMenu(i) {
  state.menuIndex = i;
  sound.confirm();
  openTopic(topicById(MENU[i].topic));
}

function openTopic(topic) {
  if (!topic) return showMenu();
  if (topic.view === 'report') showReport(topic);
  else if (topic.view === 'map') showMap(topic);
  else if (topic.view === 'interkom') showInterkom();
  else if (topic.view === 'help') showHelp();
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

function stamp() {
  const d = new Date();
  return `${CONFIG.year}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showReport(topic) {
  leave();
  state.view = 'report';
  setTitle(topic.title, '2B ◂');
  setHint('⏎ ÜBERSPRINGEN · ↑↓ BLÄTTERN · ESC MENÜ');
  view.innerHTML = `<div class="report">
      <div class="report-head"><span>REF ${topic.id.toUpperCase().slice(0, 4)}-${pad(topic.title.length * 37, 4)} // ${esc(CONFIG.stationCode)}</span><span>${stamp()}</span></div>
      ${topic.blocks.map(blockHtml).join('')}
    </div>`;
  typewrite(view.firstElementChild);
}

function showHelp() {
  leave();
  state.view = 'help';
  setTitle('HILFE', '0H ◂');
  setHint('ESC MENÜ');
  const examples = TOPICS.filter((t) => t.example);
  view.innerHTML = `<div class="report help">
      <p>STELLEN SIE IHRE FRAGE IN NORMALER SPRACHE ODER WÄHLEN SIE EINEN MENÜPUNKT PER BUCHSTABE + ENTER.</p>
      <p class="dim">VERFÜGBARE INFORMATIONSKATEGORIEN:</p>
      <div class="help-grid">
        ${examples.map((t) => `<div class="help-item"><span class="hl">${esc(t.title)}</span><span class="dim">z.B. „${esc(t.example)}“</span></div>`).join('')}
      </div>
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
      if (info.plan) setHint('←→ RAUM WÄHLEN · RAUM-ID+⏎ · ↑ ZURÜCK · ESC MENÜ');
      else setHint(info.next ? `A+⏎ ${info.next} · ↑ ZURÜCK · ESC MENÜ` : '↑ ZURÜCK · ESC MENÜ');
    },
  });
  state.map.show(LEVELS.indexOf(topic.level));
}

// ---------- Interkom ----------

function showInterkom() {
  leave();
  state.view = 'interkom';
  setTitle('INTERKOM', '3C ◂');
  setHint('↑↓ WÄHLEN · A ANRUFEN · B NACHRICHT · ESC');
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
  setTitle(mode === 'call' ? 'INTERKOM // VERBINDUNG' : 'INTERKOM // NACHRICHT', '3D ◂');
  setHint('⏎ SENDEN · ESC TRENNEN');
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
    chatLine('sys', `NACHRICHT ÜBERMITTELT // ${stamp()}`);
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

// ---------- Freie Anfrage ----------

async function query(raw) {
  const hit = matchTopic(raw, TOPICS);
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
  openTopic(hit.topic);
}

// ---------- Tastatur ----------

function back() {
  sound.beep();
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
    state.menuIndex = (state.menuIndex + dir + MENU.length) % MENU.length;
    markMenu();
    sound.click();
  } else if (state.view === 'interkom') {
    state.personIndex = (state.personIndex + dir + PERSONNEL.length) % PERSONNEL.length;
    renderProfile();
    sound.click();
  } else if (state.view === 'map' && state.map) {
    if (dir < 0) state.map.ascend();
    else state.map.descend();
  } else {
    const scroller = $('.report', view) || $('.chat-log', view);
    if (scroller) scroller.scrollTop += dir * 80;
  }
}

function submit() {
  const raw = state.buffer.trim();
  state.buffer = '';
  renderCmd();

  if (state.view === 'chat') {
    if (raw) sendChat(raw);
    return;
  }
  if (!raw) {
    if (state.view === 'menu') openMenu(state.menuIndex);
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
    const i = MENU.findIndex((m) => m.key.toLowerCase() === lower);
    if (i >= 0) return openMenu(i);
  }
  if (['menu', 'menue', 'hauptmenue', 'zurueck', 'back', 'exit'].includes(normalize(raw))) return showMenu();
  query(raw);
}

function onKey(e) {
  if (!state.ready) return;
  if (e.key === 'F9') { e.preventDefault(); sound.toggle(); updateFlags(); return; }
  if (e.key === 'F10') { e.preventDefault(); document.body.classList.toggle('crt'); return; }
  if (e.key === 'F8') {
    e.preventDefault();
    const on = document.body.classList.toggle('retro');
    try { localStorage.setItem('apollo.retro', on ? '1' : ''); } catch { /* egal */ }
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

// Änderungen aus dem Karten-Editor (anderes Fenster) live übernehmen
addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('apollo.map.') && state.view === 'map') state.map?.redrawStation();
});

async function main() {
  try { if (localStorage.getItem('apollo.retro')) document.body.classList.add('retro'); } catch { /* egal */ }
  fit();
  addEventListener('resize', fit);
  addEventListener('keydown', onKey);
  initChrome();
  await runBoot($('#boot'), CONFIG, sound);
  const app = $('#app');
  app.hidden = false;
  app.classList.add('appear');
  showMenu();
  state.ready = true;
}

main();
