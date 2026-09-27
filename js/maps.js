// Animierte Karten: Sternenkarte → Sonnensystem → Mond → Station.
// Gezoomt wird über die viewBox des SVG, dadurch bleiben alle Linien scharf.

const NS = 'http://www.w3.org/2000/svg';
export const W = 1000;
export const H = 446;
export const LEVELS = ['stars', 'system', 'moon', 'station'];
const FULL = { x: 0, y: 0, w: W, h: H };

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeIn = (k) => k ** 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function txt(parent, x, y, str, cls, attrs = {}) {
  const t = el('text', { x, y, class: cls, ...attrs }, parent);
  t.textContent = str;
  return t;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

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

function rings(g, cx, cy, radii, r) {
  radii.forEach((rad) => {
    el('circle', { cx, cy, r: rad, class: 'm-orbit' }, g);
    const a = r() * Math.PI * 2;
    el('circle', { cx: cx + Math.cos(a) * rad, cy: cy + Math.sin(a) * rad, r: 3.5, class: 'm-node' }, g);
  });
}

// ---------- Ebenen ----------

function drawStars(g, cfg) {
  const r = rng(11);
  drawBackdrop(g, r, [65, 150, 300, 470, 880], [115, 230, 395]);
  for (let i = 0; i < 80; i++) {
    el('circle', {
      cx: (r() * W).toFixed(1), cy: (r() * H).toFixed(1), r: (0.6 + r() * 1.4).toFixed(1),
      class: 'm-star', opacity: (0.3 + r() * 0.7).toFixed(2),
    }, g);
  }
  rings(g, 165, 345, [82, 72], r);
  rings(g, 770, 235, [128, 108, 26], r);
  [['A132', 115, 330], ['A234', 330, 95], ['A345', 600, 62], ['B244', 820, 160], ['A756', 600, 392]]
    .forEach(([name, x, y]) => {
      el('circle', { cx: x, cy: y, r: 6, class: 'm-dot' }, g);
      txt(g, x + 10, y + 4, name, 'm-label');
    });
  const T = { x: 330, y: 235 };
  rings(g, T.x, T.y, [150, 136], r);
  el('circle', { cx: T.x, cy: T.y, r: 9, class: 'm-target' }, g);
  return { title: 'STERNENKARTE', target: T, lock: ['TARGET LOCKED', cfg.system], coord: '291035710' };
}

function drawSystem(g, cfg) {
  const r = rng(23);
  drawBackdrop(g, r, [90, 250, 750, 910], [90, 356]);
  const C = { x: 500, y: 223 };
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const orbits = [[48, 125], [88, 35], [140, 320], [215, 150], [305, 20], [410, 205]];
  let T = null;
  orbits.forEach(([rad, deg], i) => {
    const ry = rad * 0.62;
    el('ellipse', { cx: C.x, cy: C.y, rx: rad, ry, class: 'm-orbit' }, g);
    const a = (deg * Math.PI) / 180;
    const p = { x: C.x + rad * Math.cos(a), y: C.y + ry * Math.sin(a) };
    if (i === 2) {
      el('circle', { cx: p.x, cy: p.y, r: 24, class: 'm-orbit' }, g);
      el('circle', { cx: p.x, cy: p.y, r: 8, class: 'm-planet' }, g);
      txt(g, p.x - 14, p.y + 40, cfg.planet, 'm-label');
      const m = (-40 * Math.PI) / 180;
      T = { x: p.x + 24 * Math.cos(m), y: p.y + 24 * Math.sin(m) };
      el('circle', { cx: T.x, cy: T.y, r: 4.5, class: 'm-target' }, g);
    } else {
      el('circle', { cx: p.x, cy: p.y, r: 4 + (i % 3) * 2, class: 'm-dot' }, g);
      txt(g, p.x + 10, p.y + 4, `${cfg.star} ${roman[i]}`, 'm-label');
    }
  });
  el('circle', { cx: C.x, cy: C.y, r: 22, class: 'm-orbit' }, g);
  el('circle', { cx: C.x, cy: C.y, r: 13, class: 'm-target' }, g);
  txt(g, C.x, C.y - 32, cfg.star, 'm-label', { 'text-anchor': 'middle' });
  return { title: 'SONNENSYSTEM', target: T, lock: ['TARGET LOCKED', cfg.moon], coord: cfg.systemCode.replace(/ /g, '') };
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
  ['LAT   32.14 N', 'LON  118.07 E', 'GRAV   0.38 G', 'ATM    NONE', 'TEMP  -142 °C'].forEach((line, i) => {
    txt(g, 30, 250 + i * 22, line, 'm-read');
  });
  return { title: `MONDKARTE ${cfg.moon}`, target: S, lock: ['TARGET LOCKED', cfg.station], coord: 'DEC 0084 6402' };
}

function drawStation(g, cfg, station) {
  const r = rng(41);
  drawBackdrop(g, r, [30, 970], [40, 406]);
  [[170, 60], [830, 400], [520, 430], [930, 40], [60, 420]].forEach(([cx, cy]) => {
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    for (let k = 1; k <= 6; k++) {
      const rad = 22 * k;
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const f = 1 + 0.18 * (0.6 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.2 * Math.sin(2 * a + ph[2]));
        pts.push(`${(cx + Math.cos(a) * rad * f * 1.4).toFixed(1)} ${(cy + Math.sin(a) * rad * f).toFixed(1)}`);
      }
      el('path', { d: `M${pts.join('L')}Z`, class: 'm-topo' }, g);
    }
  });

  const byId = Object.fromEntries(station.modules.map((m) => [m.id, m]));
  const center = (m) => ({ x: m.x + m.w / 2, y: m.y + m.h / 2 });
  station.corridors.forEach(([a, b]) => {
    if (!byId[a] || !byId[b]) return;
    const A = center(byId[a]);
    const B = center(byId[b]);
    el('path', { d: `M${A.x} ${A.y} H${B.x} V${B.y}`, class: 'm-corr' }, g);
  });

  let terminal = station.modules[0];
  station.modules.forEach((m) => {
    if (m.terminal) terminal = m;
    const mg = el('g', { class: `m-mod ${m.status || 'ok'}` }, g);
    el('rect', { x: m.x, y: m.y, width: m.w, height: m.h }, mg);
    txt(mg, m.x + m.w / 2, m.y + m.h / 2 + 2, m.name, 'm-mod-t', { 'text-anchor': 'middle' });
    txt(mg, m.x + m.w / 2, m.y + m.h / 2 + 20, m.code, 'm-mod-c', { 'text-anchor': 'middle' });
    if (m.status === 'damage') txt(mg, m.x, m.y + m.h + 18, '▲ SCHADEN', 'm-tag');
    if (m.status === 'warn') txt(mg, m.x, m.y + m.h + 18, '▲ WARNUNG', 'm-tag');
  });

  txt(g, 950, 70, 'N ▲', 'm-read', { 'text-anchor': 'end' });
  el('path', { d: 'M820 385 v8 h120 v-8 M880 389 v4', class: 'm-scale' }, g);
  txt(g, 880, 378, '50 M', 'm-read', { 'text-anchor': 'middle' });

  const c = center(terminal);
  return {
    title: 'STATIONSPLAN',
    target: c,
    lock: ['YOU ARE HERE', `TERMINAL ${cfg.terminalId}`],
    coord: cfg.stationCode,
    lockSize: { x: terminal.w / 2 + 12, y: terminal.h / 2 + 12 },
    lockAbove: true,
  };
}

const DRAW = { stars: drawStars, system: drawSystem, moon: drawMoon, station: drawStation };

// ---------- Ansicht ----------

export class MapView {
  constructor(root, { config, station, sound, onLevel }) {
    Object.assign(this, { root, config, station, sound, onLevel });
    root.innerHTML = `
      <svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg>
      <div class="hud hud-tl"><div>RANGE</div><div class="hud-range">${LEVELS.map((_, i) => `<span>${i + 1}</span>`).join('')}</div><div class="dim">RINGS ON</div></div>
      <div class="hud hud-tr"><div>R VECTORS</div><div class="dim">TRAILS OFF</div></div>
      <div class="hud hud-bl"><span class="hud-state">STBY</span></div>
      <div class="hud hud-br">L VECTORS</div>
      <div class="hud-ruler"></div>`;
    this.svg = root.querySelector('svg');
    this.token = 0;
    this.level = -1;
    this.animating = false;
  }

  setVB(r) { this.svg.setAttribute('viewBox', `${r.x} ${r.y} ${r.w} ${r.h}`); }

  setState(s) {
    const n = this.root.querySelector('.hud-state');
    if (n) n.textContent = s;
  }

  draw(i) {
    this.svg.replaceChildren();
    this.layer = el('g', {}, this.svg);
    this.info = DRAW[LEVELS[i]](this.layer, this.config, this.station);
    this.level = i;
    this.root.querySelectorAll('.hud-range span').forEach((s, k) => s.classList.toggle('on', k === i));
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
      const e = ease(k);
      this.setVB(interpolate(from, to, e));
      if (opacity) this.layer.style.opacity = opacity(k);
    }, tok);
  }

  // Fliegt von Ebene fromIdx bis zur Ebene targetIdx und rastet auf jedem Ziel ein.
  async flyTo(targetIdx, fromIdx = 0, { relock = true } = {}) {
    const tok = ++this.token;
    this.targetIdx = targetIdx;
    this.animating = true;
    this.setState('TRACKING');
    for (let i = fromIdx; i <= targetIdx; i++) {
      this.draw(i);
      if (i > fromIdx) {
        this.sound.zoom();
        await this.zoomTo(scaled(FULL, 4), FULL, 600, easeOut, tok, (k) => Math.min(1, k * 1.6));
      } else if (relock) {
        await this.zoomTo(scaled(FULL, 1.12), FULL, 450, easeOut, tok, (k) => k);
      } else {
        this.setVB(FULL);
      }
      if (tok !== this.token) return;
      const lock = await this.lockOn(tok, !relock && i === fromIdx);
      if (tok !== this.token) return;
      if (i < targetIdx) {
        await sleep(200);
        if (tok !== this.token) return;
        lock.querySelectorAll('text').forEach((t) => t.remove());
        this.sound.zoom();
        const into = scaled(FULL, 0.04, this.info.target.x, this.info.target.y);
        await this.zoomTo(FULL, into, 800, easeIn, tok, (k) => 1 - Math.max(0, (k - 0.55) / 0.45));
        if (tok !== this.token) return;
      }
    }
    this.animating = false;
    this.setState('LOCK');
  }

  // Animation abbrechen und direkt das Endbild zeigen.
  skip() {
    if (!this.animating) return;
    const tok = ++this.token;
    this.animating = false;
    this.draw(this.targetIdx);
    this.setVB(FULL);
    this.layer.style.opacity = 1;
    this.lockOn(tok, true);
    this.setState('LOCK');
  }

  zoomIn() {
    if (this.animating || this.level >= LEVELS.length - 1) return;
    this.flyTo(this.level + 1, this.level, { relock: false });
  }

  zoomOut() {
    if (this.animating || this.level <= 0) return;
    this.flyTo(this.level - 1, this.level - 1);
  }

  destroy() { this.token++; }

  async lockOn(tok, instant) {
    const info = this.info;
    const { x, y } = info.target;
    const size = info.lockSize || { x: 24, y: 24 };
    const g = el('g', { class: 'lock', transform: `translate(${x} ${y})` }, this.layer);
    if (!info.lockSize) el('rect', { x: -15, y: -15, width: 30, height: 30, class: 'm-lockbox' }, g);
    const br = el('path', { class: 'm-lock' }, g);
    const setSize = (grow) => br.setAttribute('d', corners(size.x + grow, size.y + grow));

    let t1, t2, t3;
    if (info.lockAbove) {
      t3 = txt(g, 0, -size.y - 50, '', 'm-coord', { 'text-anchor': 'middle' });
      t1 = txt(g, 0, -size.y - 30, '', 'm-lock-t sm', { 'text-anchor': 'middle' });
      t2 = txt(g, 0, -size.y - 12, '', 'm-lock-t2 sm', { 'text-anchor': 'middle' });
    } else {
      const left = x > W * 0.62;
      const tx = left ? -size.x - 18 : size.x + 18;
      const anchor = left ? 'end' : 'start';
      t3 = txt(g, tx, -30, '', 'm-coord', { 'text-anchor': anchor });
      t1 = txt(g, tx, -4, '', 'm-lock-t', { 'text-anchor': anchor });
      t2 = txt(g, tx, 24, '', 'm-lock-t2', { 'text-anchor': anchor });
    }
    const fill = () => {
      t1.textContent = info.lock[0];
      t2.textContent = info.lock[1];
      t3.textContent = info.coord;
    };
    if (instant) {
      setSize(0);
      fill();
      return g;
    }

    await this.tween(420, (k) => setSize(70 * (1 - easeOut(k))), tok);
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
