// Synthetische Terminal-Geräusche über die Web Audio API (keine Audiodateien nötig).

let ctx = null;
let enabled = true;
let lastTick = 0;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'square', gain = 0.03, when = 0, slide = null } = {}) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sound = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; return enabled; },
  unlock() { audio(); },
  click() { tone(1500 + Math.random() * 400, 0.018, { gain: 0.012 }); },
  tick() {
    const now = performance.now();
    if (now - lastTick < 45) return;
    lastTick = now;
    tone(2300 + Math.random() * 300, 0.01, { gain: 0.006 });
  },
  beep() { tone(880, 0.06, { gain: 0.02 }); },
  confirm() { tone(660, 0.06); tone(990, 0.09, { when: 0.07 }); },
  error() { tone(190, 0.28, { type: 'sawtooth', gain: 0.03 }); },
  lock() { tone(1250, 0.05); tone(1250, 0.05, { when: 0.1 }); tone(1650, 0.14, { when: 0.2 }); },
  ring() { tone(440, 0.4, { type: 'sine', gain: 0.05 }); tone(480, 0.4, { type: 'sine', gain: 0.05 }); },
  zoom() { tone(260, 0.7, { type: 'triangle', gain: 0.025, slide: 1100 }); },
  hum() { tone(55, 1.8, { type: 'sawtooth', gain: 0.05, slide: 70 }); tone(3000, 0.5, { type: 'sine', gain: 0.01, slide: 9000 }); },
};
