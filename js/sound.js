// Synthetische Terminal-Geräusche (Web Audio API, keine Audiodateien).
// Klangbild angelehnt an die Rechner in ALIEN: dumpfe Relais, Fernschreiber-Rattern,
// tiefe, gefilterte Töne statt heller Pieptöne. Alles läuft über einen Tiefpass.

let ctx = null;
let out = null;
let noiseBuf = null;
let enabled = true;
let lastTick = 0;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    lp.connect(comp).connect(master).connect(ctx.destination);
    out = lp;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(gainNode, t, peak, attack, dur) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.linearRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// Gefilterter Ton
function tone(freq, dur, { type = 'sine', gain = 0.05, when = 0, slide = null, attack = 0.008, cutoff = 1200 } = {}) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const f = c.createBiquadFilter();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  env(amp, t, gain, attack, dur);
  osc.connect(f).connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Rauschimpuls (Relais, Fernschreiber, Luftzug)
function noise(dur, { freq = 1400, q = 3, gain = 0.06, when = 0, type = 'bandpass', sweep = null, attack = 0.001 } = {}) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const amp = c.createGain();
  env(amp, t, gain, attack, dur);
  src.connect(f).connect(amp).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// Mechanisches Klacken: kurzer Rauschimpuls plus tiefer Körper
function clack(when = 0, gain = 1) {
  noise(0.025, { freq: 900 + Math.random() * 500, q: 2.5, gain: 0.09 * gain, when });
  tone(110 + Math.random() * 30, 0.04, { type: 'triangle', gain: 0.05 * gain, when, cutoff: 500 });
}

export const sound = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; return enabled; },
  unlock() { audio(); },

  // Tastenanschlag: dumpfes Klacken
  click() { clack(0, 0.8); },

  // Textausgabe: Fernschreiber-Rattern
  tick() {
    const now = performance.now();
    if (now - lastTick < 55) return;
    lastTick = now;
    noise(0.018, { freq: 1700 + Math.random() * 900, q: 4, gain: 0.035 });
  },

  // Kurzes Signal: tiefer, weicher Doppelton
  beep() {
    tone(392, 0.12, { type: 'triangle', gain: 0.05, cutoff: 900 });
    tone(196, 0.14, { type: 'sine', gain: 0.04, cutoff: 600 });
  },

  // Bestätigung: Relais + absteigende Quinte
  confirm() {
    clack(0, 0.7);
    tone(349, 0.16, { type: 'triangle', gain: 0.05, when: 0.04, cutoff: 1000 });
    tone(233, 0.28, { type: 'triangle', gain: 0.05, when: 0.16, cutoff: 800 });
  },

  // Fehler: tiefes, raues Brummen
  error() {
    tone(62, 0.5, { type: 'sawtooth', gain: 0.09, cutoff: 380 });
    tone(65, 0.5, { type: 'square', gain: 0.04, cutoff: 300 });
    noise(0.3, { freq: 220, q: 1, gain: 0.04, type: 'lowpass' });
  },

  // Zielerfassung: drei Relais, dann tiefer Halteton
  lock() {
    [0, 0.09, 0.18].forEach((w) => clack(w, 0.9));
    tone(147, 0.5, { type: 'triangle', gain: 0.06, when: 0.26, cutoff: 700 });
    tone(220, 0.45, { type: 'sine', gain: 0.03, when: 0.26, cutoff: 700 });
  },

  // Interkom-Ruf: pulsierender tiefer Doppelton
  ring() {
    for (let i = 0; i < 4; i++) {
      tone(185, 0.09, { type: 'square', gain: 0.035, when: i * 0.11, cutoff: 600 });
      tone(277, 0.09, { type: 'square', gain: 0.025, when: i * 0.11, cutoff: 600 });
    }
  },

  // Zoom: Luftzug mit tiefem Anstieg
  zoom() {
    noise(0.75, { freq: 300, sweep: 1800, q: 1.2, gain: 0.05, attack: 0.25 });
    tone(55, 0.75, { type: 'sine', gain: 0.06, slide: 90, attack: 0.2, cutoff: 300 });
  },

  // Einschalten: tiefes Anlaufen der Anlage
  hum() {
    tone(36, 2.4, { type: 'sawtooth', gain: 0.09, slide: 55, attack: 0.6, cutoff: 220 });
    tone(72, 2.2, { type: 'sine', gain: 0.05, slide: 110, attack: 0.8, cutoff: 400 });
    noise(1.8, { freq: 120, sweep: 600, q: 0.8, gain: 0.04, attack: 0.9, type: 'lowpass' });
    [0.9, 1.25, 1.5].forEach((w) => clack(w, 1));
  },

  // Alarmsirene (Selbstzerstörung): an- und abschwellender Zweiklang
  alarm() {
    tone(330, 0.9, { type: 'sawtooth', gain: 0.07, slide: 520, attack: 0.05, cutoff: 1400 });
    tone(520, 0.9, { type: 'sawtooth', gain: 0.06, slide: 330, attack: 0.05, cutoff: 1400, when: 0.95 });
  },

  // Detonation
  boom() {
    noise(3.5, { freq: 900, sweep: 60, q: 0.6, gain: 0.25, attack: 0.01, type: 'lowpass' });
    tone(48, 3, { type: 'sawtooth', gain: 0.2, slide: 22, attack: 0.01, cutoff: 200 });
  },
};
