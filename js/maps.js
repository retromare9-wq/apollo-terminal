// Animierte Karten: Sternenkarte → Sonnensystem → Mond → Station.
// Gezoomt wird über die viewBox des SVG, dadurch bleiben alle Linien scharf.
// Jede Ebene rastet auf ein Ziel ein; mit A (oder ↓) geht es eine Ebene tiefer.

import { el, txt, rng } from './svg.js';
import { drawStarmap, SOL } from './starmap.js';
import { drawStationPlan, roomName, roomCode, roomZone, frame, applyZoom } from './stationplan.js';
import { semioticSvg } from './semiotic.js';
import { loadLayer, roomDoors, roomCams, SECURITY } from './layer.js';

export const W = 1000;
export const H = 446;
export const LEVELS = ['stars', 'system', 'moon', 'station'];
const FULL = { x: 0, y: 0, w: W, h: H };

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeIn = (k) => k ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function scaled(rect, factor, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2) {
  const w = rect.w * factor;
  const h = rect.h * factor;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// Größe logarithmisch interpolieren, damit sich der Zoom gleichmäßig anfühlt.
function interpolate(a, b, k) {
  const w = Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * k);
  const f = a.w === b.w ? k : (a.w - w) / (a.w - b.w);
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const h = w * (a.h / a.w);
  return { x: acx + (bcx - acx) * f - w / 2, y: acy + (bcy - acy) * f - h / 2, w, h };
}

function corners(sx, sy) {
  const a = Math.min(sx, sy) * 0.5;
  return `M${-sx} ${-sy + a} V${-sy} H${-sx + a} M${sx - a} ${-sy} H${sx} V${-sy + a}`
    + ` M${sx} ${sy - a} V${sy} H${sx - a} M${-sx + a} ${sy} H${-sx} V${sy - a}`;
}

// ---------- Hintergrund ----------

function drawBackdrop(g, r, vx, hy) {
  vx.forEach((x) => el('line', { x1: x, y1: 0, x2: x, y2: H, class: 'm-grid' }, g));
  hy.forEach((y) => el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'm-grid' }, g));
  el('line', { x1: -50, y1: 60, x2: W + 50, y2: 200, class: 'm-vec' }, g);
  el('line', { x1: -50, y1: 290, x2: W + 50, y2: 450, class: 'm-vec' }, g);
  for (let i = 0; i < 16; i++) {
    el('circle', { cx: (r() * W).toFixed(1), cy: (r() * H).toFixed(1), r: (1.5 + r() * 3).toFixed(1), class: 'm-speck' }, g);
  }
  [['11024', 18], ['11234', 440], ['11444', 862]].forEach(([s, x]) => txt(g, x, H - 12, s, 'm-num'));
}

// ---------- Ebenen ----------

function drawSystem(g, cfg) {
  const r = rng(23);
  drawBackdrop(g, r, [90, 250, 750, 910], [90, 356]);
  const C = { x: 500, y: 223 };
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const orbits = [[48, 125], [88, 35], [150, 320], [225, 150], [310, 20], [410, 205]];
  let T = null;
  orbits.forEach(([rad, deg], i) => {
    const ry = rad * 0.62;
    el('ellipse', { cx: C.x, cy: C.y, rx: rad, ry, class: 'm-orbit' }, g);
    const a = (deg * Math.PI) / 180;
    const p = { x: C.x + rad * Math.cos(a), y: C.y + ry * Math.sin(a) };
    if (i === 2) {
      // Gasriese mit Bändern und Ring, darum der Mond
      el('circle', { cx: p.x, cy: p.y, r: 30, class: 'm-orbit' }, g);
      el('ellipse', { cx: p.x, cy: p.y, rx: 21, ry: 5, class: 'm-gasring' }, g);
      el('circle', { cx: p.x, cy: p.y, r: 12, class: 'm-planet' }, g);
      [-5, 0, 5].forEach((dy) => el('line', { x1: p.x - Math.sqrt(144 - dy * dy), y1: p.y + dy, x2: p.x + Math.sqrt(144 - dy * dy), y2: p.y + dy, class: 'm-band' }, g));
      txt(g, p.x, p.y + 50, cfg.planet, 'm-label', { 'text-anchor': 'middle' });
      const m = (-40 * Math.PI) / 180;
      T = { x: p.x + 30 * Math.cos(m), y: p.y + 30 * Math.sin(m) };
      el('circle', { cx: T.x, cy: T.y, r: 4.5, class: 'm-target' }, g);
    } else {
      el('circle', { cx: p.x, cy: p.y, r: 4 + (i % 3) * 2, class: 'm-dot' }, g);
      txt(g, p.x + 10, p.y + 4, `${cfg.star}-${roman[i]}`, 'm-label');
    }
  });
  el('circle', { cx: C.x, cy: C.y, r: 22, class: 'm-orbit' }, g);
  el('circle', { cx: C.x, cy: C.y, r: 13, class: 'm-target' }, g);
  txt(g, C.x, C.y - 32, cfg.star, 'm-label', { 'text-anchor': 'middle' });
  return {
    title: `SYSTEMKARTE ${cfg.star}`,
    target: T,
    lock: ['TARGET LOCKED', cfg.moon],
    coord: `${cfg.planet} // ORBIT`,
    lockTag: 'A',
    next: `MOND ${cfg.moon}`,
  };
}

function drawMoon(g, cfg) {
  const r = rng(5);
  drawBackdrop(g, r, [120, 880], [60, 386]);
  const C = { x: 500, y: 223 };
  const R = 180;
  const defs = el('defs', {}, g);
  const clip = el('clipPath', { id: 'moon-clip' }, defs);
  el('circle', { cx: C.x, cy: C.y, r: R }, clip);

  el('circle', { cx: C.x, cy: C.y, r: R + 34, class: 'm-vec' }, g);
  el('circle', { cx: C.x, cy: C.y, r: R, class: 'm-globe' }, g);
  const surface = el('g', { 'clip-path': 'url(#moon-clip)' }, g);
  [-60, -30, 0, 30, 60].forEach((lat) => {
    const a = (lat * Math.PI) / 180;
    const y = C.y + R * Math.sin(a);
    const hw = R * Math.cos(a);
    el('line', { x1: C.x - hw, y1: y, x2: C.x + hw, y2: y, class: 'm-lat' }, surface);
  });
  [30, 60].forEach((lon) => {
    el('ellipse', { cx: C.x, cy: C.y, rx: R * Math.sin((lon * Math.PI) / 180), ry: R, class: 'm-lat' }, surface);
  });
  el('line', { x1: C.x, y1: C.y - R, x2: C.x, y2: C.y + R, class: 'm-lat' }, surface);
  for (let i = 0; i < 24; i++) {
    const d = R * Math.sqrt(r());
    const a = r() * Math.PI * 2;
    el('circle', { cx: C.x + Math.cos(a) * d, cy: C.y + Math.sin(a) * d, r: (3 + r() * 16).toFixed(1), class: 'm-crater' }, surface);
  }
  el('path', { d: `M${C.x} ${C.y - R} A${R} ${R} 0 0 0 ${C.x} ${C.y + R} A${R * 0.45} ${R} 0 0 1 ${C.x} ${C.y - R} Z`, class: 'm-shade' }, surface);

  const S = { x: C.x + 58, y: C.y - 70 };
  el('circle', { cx: S.x, cy: S.y, r: 14, class: 'm-orbit' }, g);
  el('circle', { cx: S.x, cy: S.y, r: 6, class: 'm-dot' }, g);
  txt(g, C.x - R - 20, C.y - R + 20, cfg.moon, 'm-label', { 'text-anchor': 'end' });
  [`PRIMARY ${cfg.planet}`, 'LAT   32.14 N', 'LON  118.07 E', 'GRAV   0.38 G', 'ATM    NONE', 'TEMP  -142 °C'].forEach((line, i) => {
    txt(g, 30, 240 + i * 22, line, 'm-read');
  });
  return {
    title: `MOND ${cfg.moon}`,
    target: S,
    lock: ['TARGET LOCKED', cfg.stationCode],
    coord: 'DEC 0084 6402',
    lockTag: 'A',
    next: 'STATIONSPLAN',
  };
}

function drawStation(g, cfg, station) {
  const lv = station.levels[0];
  return drawStationPlan(g, cfg, lv.plan, loadLayer(lv.id, lv.layer));
}

const DRAW = { stars: drawStarmap, system: drawSystem, moon: drawMoon, station: drawStation };

// ---------- Ansicht ----------

export class MapView {
  constructor(root, { config, station, sound, onLevel }) {
    Object.assign(this, { root, config, station, sound, onLevel });
    root.innerHTML = `
      <svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="hud hud-tl"><div>RANGE</div><div class="hud-range">${LEVELS.map((_, i) => `<span>${i + 1}</span>`).join('')}</div><div class="dim">RINGS ON</div></div>
      <div class="hud hud-tr"><div>R VECTORS</div><div class="dim">TRAILS OFF</div></div>
      <div class="hud hud-bl"><div class="hud-dist"></div><span class="hud-state">STBY</span></div>
      <div class="hud hud-br">L VECTORS</div>
      <div class="hud-ruler"></div>
      <aside class="star-panel" hidden></aside>`;
    this.svg = root.querySelector('svg');
    this.panel = root.querySelector('.star-panel');
    this.token = 0;
    this.level = -1;
    this.animating = false;
  }

  setVB(r) {
    this.vb = r;
    this.svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`);
    // Einheiten pro Bildschirmpixel – für gleichbleibende Schriftgrößen im Stationsplan
    applyZoom(this.svg, r.w / (this.svg.clientWidth || 1214));
  }

  setState(s) { this.root.querySelector('.hud-state').textContent = s; }

  setDist(text) { this.root.querySelector('.hud-dist').textContent = text; }

  draw(i) {
    this.svg.replaceChildren();
    this.layer = el('g', {}, this.svg);
    this.info = DRAW[LEVELS[i]](this.layer, this.config, this.station);
    this.home = this.info.home || FULL;
    this.level = i;
    this.sel = null;
    this._order = null;
    this.root.classList.toggle('lvl-station', !!this.info.plan);
    this.root.classList.toggle('lvl-stars', LEVELS[i] === 'stars');
    this.root.querySelectorAll('.hud-range span').forEach((s, k) => s.classList.toggle('on', k === i));
    this.panel.hidden = true;
    this.setDist(LEVELS[i] === 'stars' ? `DIST SOL ${this.config.starmap.distancePc.toFixed(2)} PC` : '');
    if (this.onLevel) this.onLevel(i, this.info);
  }

  tween(dur, fn, tok) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (t) => {
        if (tok !== this.token) return resolve(false);
        const k = Math.min(1, (t - t0) / dur);
        fn(k);
        if (k < 1) requestAnimationFrame(step);
        else resolve(true);
      };
      requestAnimationFrame(step);
    });
  }

  zoomTo(from, to, dur, ease, tok, opacity) {
    return this.tween(dur, (k) => {
      this.setVB(interpolate(from, to, ease(k)));
      if (opacity) this.layer.style.opacity = opacity(k);
    }, tok);
  }

  // Ebene i anzeigen: Anflug, Einrasten, ggf. Datenpanel.
  async show(i, { arrive = 'fade' } = {}) {
    const tok = ++this.token;
    this.pending = null;
    this.animating = true;
    this.draw(i);
    this.setState('TRACKING');
    if (this.info.start) await this.flight(tok);
    else if (arrive === 'zoom') {
      this.sound.zoom();
      await this.zoomTo(scaled(this.home, 4), this.home, 650, easeOut, tok, (k) => Math.min(1, k * 1.6));
    } else {
      await this.zoomTo(scaled(this.home, 1.12), this.home, 450, easeOut, tok, (k) => k);
    }
    if (tok !== this.token) return;
    if (!this.info.noLock) await this.lockOn(tok, false);
    if (tok !== this.token) return;
    if (this.info.panel) await this.showPanel(tok, false);
    if (tok !== this.token) return;
    this.animating = false;
    this.setState('LOCK');
  }

  // Seitlicher Anflug von Sol aus mit Drehung, Route und Entfernungszähler.
  async flight(tok) {
    const { start, via, home, target, world, route } = this.info;
    const end = { x: home.x + home.w / 2, y: home.y + home.h / 2 };
    const total = this.config.starmap.distancePc;
    this.sound.zoom();
    setTimeout(() => { if (tok === this.token) this.sound.zoom(); }, 1500);
    await this.tween(3600, (k) => {
      const e = easeInOut(k);
      const w = Math.exp(Math.log(start.w) + (Math.log(home.w) - Math.log(start.w)) * e);
      const h = w * (H / W);
      const u = 1 - e;
      const cx = u * u * start.cx + 2 * u * e * via.x + e * e * end.x;
      const cy = u * u * start.cy + 2 * u * e * via.y + e * e * end.y;
      this.setVB({ x: cx - w / 2, y: cy - h / 2, w, h });
      world.setAttribute('transform', `rotate(${(-16 * (1 - e)).toFixed(3)} ${target.x} ${target.y})`);
      this.layer.style.opacity = Math.min(1, k * 4);
      const p = Math.min(1, k * 1.15);
      route.setAttribute('x2', SOL.x + (target.x - SOL.x) * p);
      route.setAttribute('y2', SOL.y + (target.y - SOL.y) * p);
      this.setDist(`DIST SOL ${(total * p).toFixed(2).padStart(5, '0')} PC`);
    }, tok);
  }

  async showPanel(tok, instant) {
    const sm = this.config.starmap;
    this.panel.innerHTML = `
      <div class="sp-head">POSITION DATA</div>
      ${sm.rows.map(([k, v]) => `<div class="sp-row"><span class="dim">${k}</span><span>${v}</span></div>`).join('')}
      <div class="sp-head">LEGEND</div>
      ${sm.legend.map(([cls, name, sub]) => `<div class="sp-leg"><i class="sw ${cls}"></i><span>${name}${sub ? `<small>${sub}</small>` : ''}</span></div>`).join('')}
      <div class="sp-key"><span class="hl">A</span> ${this.info.next}</div>`;
    this.panel.hidden = false;
    const items = [...this.panel.children];
    if (instant) return;
    items.forEach((n) => { n.style.visibility = 'hidden'; });
    for (const n of items) {
      if (tok !== this.token) break;
      n.style.visibility = 'visible';
      this.sound.tick();
      await sleep(70);
    }
    items.forEach((n) => { n.style.visibility = 'visible'; });
  }

  // Eine Ebene tiefer: ins Ziel hineinzoomen, dann die nächste Ebene anfliegen.
  async descend() {
    if (this.animating || this.level >= LEVELS.length - 1) return;
    const tok = ++this.token;
    this.animating = true;
    this.pending = this.level + 1;
    this.panel.hidden = true;
    this.layer.querySelectorAll('.lock text, .lock .m-tagbox').forEach((t) => t.remove());
    this.sound.zoom();
    const into = scaled(this.home, 0.04, this.info.target.x, this.info.target.y);
    await this.zoomTo(this.home, into, 800, easeIn, tok, (k) => 1 - Math.max(0, (k - 0.55) / 0.45));
    if (tok !== this.token) return;
    this.show(this.pending, { arrive: 'zoom' });
  }

  ascend() {
    if (this.animating) return;
    if (this.sel != null) { this.clearRoom(); return; }
    if (this.level <= 0) return;
    this.show(this.level - 1);
  }

  // Animation abbrechen und direkt das Endbild zeigen.
  skip() {
    if (!this.animating) return;
    const tok = ++this.token;
    this.animating = false;
    this.draw(this.pending ?? this.level);
    this.pending = null;
    this.setVB(this.home);
    this.layer.style.opacity = 1;
    if (this.info.route) {
      this.info.route.setAttribute('x2', this.info.target.x);
      this.info.route.setAttribute('y2', this.info.target.y);
    }
    if (!this.info.noLock) this.lockOn(tok, true);
    if (this.info.panel) this.showPanel(tok, true);
    this.setState('LOCK');
  }

  // ---------- Räume im Stationsplan ----------

  rooms() {
    if (!this.info?.plan) return [];
    if (!this._order) {
      // Lesereihenfolge: von oben nach unten, links nach rechts, grob in Zeilen
      const list = this.info.plan.level.rooms.slice();
      const key = (r) => { const b = r.rects[0]; return [Math.round(b[1] / 150), b[0]]; };
      list.sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1]; });
      this._order = list;
    }
    return this._order;
  }

  selectRoom(dir) {
    const list = this.rooms();
    if (!list.length || this.animating) return;
    const n = list.length;
    const i = this.sel == null ? (dir > 0 ? 0 : n - 1) : (this.sel + dir + n) % n;
    this.focusRoom(i);
  }

  findRoom(query) {
    const norm = (t) => String(t).toUpperCase().replace(/[^A-Z0-9ÄÖÜ.]+/g, ' ').trim();
    const q = norm(query);
    if (!q) return -1;
    const { level, layer } = this.info.plan;
    const list = this.rooms();
    const exact = list.findIndex((r) => norm(r.id) === q || norm(roomCode(r, layer)) === q || norm(roomName(level, r, layer)) === q
      || norm(r.id.replace('-', ' ')) === q || (r.unit && norm(r.unit) === q));
    if (exact >= 0) return exact;
    // Nur die Abteilung angegeben (z. B. XENO, MED, WOHN-A oder XENOBIOLOGIE): erster Raum dieser Abteilung
    const dept = (r) => norm(roomCode(r, layer).split('-')[0]);
    const hits = list.map((r, i) => ({ r, i })).filter(({ r }) => dept(r) === q || norm(roomZone(level, r, layer)) === q
      || norm(roomCode(r, layer)).startsWith(q));
    if (!hits.length) return -1;
    hits.sort((a, b) => roomCode(a.r, layer).localeCompare(roomCode(b.r, layer), 'de', { numeric: true }));
    return hits[0].i;
  }

  // Freie Navigation im Stationsplan (Strg+Pfeile, + / #)
  panBy(fx, fy) {
    if (!this.info?.plan || this.animating) return;
    const r = this.vb || this.home;
    const tok = ++this.token;
    this.zoomTo(r, { ...r, x: r.x + r.w * fx, y: r.y + r.h * fy }, 160, easeOut, tok);
  }

  zoomBy(f) {
    if (!this.info?.plan || this.animating) return;
    const r = this.vb || this.home;
    const w = Math.min(Math.max(r.w * f, 250), this.home.w * 1.5);
    const k = w / r.w;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const tok = ++this.token;
    this.zoomTo(r, { x: cx - (r.w * k) / 2, y: cy - (r.h * k) / 2, w: r.w * k, h: r.h * k }, 200, easeOut, tok);
  }


  async focusRoom(i) {
    const room = this.rooms()[i];
    const { level, nodes } = this.info.plan;
    if (this.sel != null) nodes[this.rooms()[this.sel].id]?.classList.remove('sel');
    this.sel = i;
    nodes[room.id].classList.add('sel');
    this.sound.beep();
    this.showRoom(room, level);
    const b = room.rects.reduce((m, r) => [Math.min(m[0], r[0]), Math.min(m[1], r[1]), Math.max(m[2], r[2]), Math.max(m[3], r[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const target = frame(b, 420);
    // Raum etwas links der Mitte, damit das Infopanel rechts nichts verdeckt
    target.x += target.w * 0.14;
    const tok = ++this.token;
    await this.zoomTo(this.vb || this.home, target, 450, easeOut, tok);
  }

  clearRoom() {
    const { nodes } = this.info.plan;
    if (this.sel != null) nodes[this.rooms()[this.sel].id]?.classList.remove('sel');
    this.sel = null;
    this.panel.hidden = true;
    const tok = ++this.token;
    this.zoomTo(this.vb || this.home, this.home, 450, easeOut, tok);
    if (this.onRoom) this.onRoom(null);
  }

  showRoom(room, level) {
    const layer = this.info.plan.layer;
    const data = layer.rooms[room.id] || {};
    const st = {
      warn: '<span class="warn">▲ WARNUNG</span>',
      damage: '<span class="crit blink">▲ SCHADEN</span>',
      offline: '<span class="crit">■ OFFLINE</span>',
      sealed: '<span class="crit">◆ ABGERIEGELT</span>',
    }[data.status] || 'IN ORDNUNG';
    const doors = roomDoors(layer, room);
    const levels = ['green', 'orange', 'red'].filter((k) => doors.some((d) => (d.sec || 'green') === k));
    const cams = layer.settings.showCams ? roomCams(layer, room).length : 0;
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    this.panel.innerHTML = `
      <div class="sp-head">RAUMDATEN</div>
      <div class="sp-title">${esc(roomName(level, room, layer))}</div>
      <div class="sp-row"><span class="dim">ID</span><span>${esc(roomCode(room, layer))}</span></div>
      <div class="sp-row"><span class="dim">BEREICH</span><span>${esc(roomZone(level, room, layer))}</span></div>
      <div class="sp-row"><span class="dim">EBENE</span><span>${level.name}</span></div>
      <div class="sp-row"><span class="dim">ZUGÄNGE</span><span>${doors.length}${levels.length ? ` · ${levels.map((k) => `<span class="sec-t sec-${k}">${SECURITY[k].label}</span>`).join(' ')}` : ''}</span></div>
      <div class="sp-row"><span class="dim">STATUS</span><span>${st}</span></div>
      ${layer.settings.showCams ? `<div class="sp-row"><span class="dim">ÜBERWACHUNG</span><span>${cams ? `<span class="mint">KAMERA AKTIV${cams > 1 ? ` (${cams})` : ''}</span>` : 'KEINE KAMERA'}</span></div>` : ''}
      ${data.picto?.length ? `<div class="sp-pics">${data.picto.map((p) => semioticSvg(p.id, 38)).join('')}</div>` : ''}
      ${data.info ? `<div class="sp-note">${esc(data.info)}</div>` : ''}
      <div class="sp-key">←→ RAUM · ↑ ÜBERSICHT</div>`;
    this.panel.hidden = false;
    if (this.onRoom) this.onRoom(room);
  }

  // Ebene neu zeichnen, Auswahl und Ausschnitt behalten
  redrawStation() {
    if (!this.info?.plan || this.animating) return;
    const sel = this.sel;
    const vb = this.vb;
    this.draw(this.level);
    this.setVB(vb);
    if (sel == null) return;
    this.sel = sel;
    const room = this.rooms()[sel];
    this.info.plan.nodes[room.id].classList.add('sel');
    this.showRoom(room, this.info.plan.level);
  }

  destroy() { this.token++; }

  async lockOn(tok, instant) {
    const info = this.info;
    const { x, y } = info.target;
    const s = info.lockScale || 1;
    const size = info.lockSize || { x: 24, y: 24 };
    const g = el('g', { class: 'lock', transform: `translate(${x} ${y}) scale(${s})` }, this.layer);
    if (!info.lockSize) el('rect', { x: -15, y: -15, width: 30, height: 30, class: 'm-lockbox' }, g);
    const br = el('path', { class: 'm-lock' }, g);
    const setSize = (grow) => br.setAttribute('d', corners(size.x + grow, size.y + grow));

    let t1, t2, t3;
    if (info.lockAbove) {
      t3 = txt(g, 0, -size.y - 50, '', 'm-coord', { 'text-anchor': 'middle' });
      t1 = txt(g, 0, -size.y - 30, '', 'm-lock-t sm', { 'text-anchor': 'middle' });
      t2 = txt(g, 0, -size.y - 12, '', 'm-lock-t2 sm', { 'text-anchor': 'middle' });
    } else {
      const left = (x - this.home.x) / this.home.w > 0.72;
      const tx = left ? -size.x - 18 : size.x + 18;
      const anchor = left ? 'end' : 'start';
      t3 = txt(g, tx, -30, '', 'm-coord', { 'text-anchor': anchor });
      t1 = txt(g, tx, -4, '', 'm-lock-t', { 'text-anchor': anchor });
      t2 = txt(g, tx, 24, '', 'm-lock-t2', { 'text-anchor': anchor });
    }
    const tag = () => {
      if (!info.lockTag) return;
      const tg = el('g', { class: 'm-tagbox', transform: `translate(${-size.x - 2} ${-size.y - 26})` }, g);
      el('rect', { x: 0, y: 0, width: 22, height: 22 }, tg);
      txt(tg, 11, 17, info.lockTag, '', { 'text-anchor': 'middle' });
    };
    const fill = () => {
      t1.textContent = info.lock[0];
      t2.textContent = info.lock[1];
      t3.textContent = info.coord;
      tag();
    };
    if (instant) {
      setSize(0);
      fill();
      return g;
    }

    await this.tween(480, (k) => setSize(90 * (1 - easeOut(k))), tok);
    if (tok !== this.token) return g;
    this.sound.lock();
    for (let i = 0; i < 2; i++) {
      g.style.visibility = 'hidden';
      await sleep(60);
      g.style.visibility = 'visible';
      await sleep(80);
    }
    if (tok !== this.token) return g;
    const digits = info.coord;
    await this.tween(300, (k) => {
      const n = Math.floor(digits.length * k);
      t3.textContent = digits.slice(0, n).replace(/\d/g, (d, i) => (i === n - 1 ? String(Math.floor(Math.random() * 10)) : d));
    }, tok);
    fill();
    return g;
  }
}

