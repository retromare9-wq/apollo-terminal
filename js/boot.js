// Startsequenz: Standby → Röhre schaltet ein → Systemcheck → Logo → Verbindung.
import { wyLogo } from './logo.js';

export async function runBoot(root, config, sound) {
  root.innerHTML = `
    <div class="boot-standby">
      <div>${config.model} // SYSTEM STANDBY</div>
      <div class="blink">PRESS ANY KEY TO INITIALIZE_</div>
    </div>`;
  await anyInput();
  sound.unlock();

  // Ab jetzt überspringt jede Taste den Rest.
  let skipped = false;
  let pending = [];
  const onSkip = () => {
    skipped = true;
    pending.forEach((f) => f());
    pending = [];
  };
  const sleep = (ms) => (skipped ? Promise.resolve() : new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); pending = pending.filter((f) => f !== done); resolve(); }
    pending.push(done);
  }));
  setTimeout(() => {
    addEventListener('keydown', onSkip);
    addEventListener('pointerdown', onSkip);
  }, 0);

  root.innerHTML = '<pre class="boot-log"></pre>';
  root.classList.add('power-on');
  sound.hum();
  await sleep(900);

  const log = root.querySelector('.boot-log');
  const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const src = Array.isArray(config.boot) && config.boot.length ? config.boot : [`LOADING ${config.computer} KERNEL`];
  const lines = src.map((l, i) => {
    const h = escH(l).replace(/(\d* ?WARNINGS?|WARNUNG(EN)?|FEHLER|ERROR)/g, '<span class="warn">$1</span>');
    return i === src.length - 1 ? `${h} <span class="blink">_</span>` : h;
  });
  for (const line of lines) {
    if (skipped) break;
    log.insertAdjacentHTML('beforeend', `${line}\n`);
    sound.tick();
    await sleep(line ? 150 : 60);
  }
  await sleep(500);

  if (!skipped) {
    root.innerHTML = `
      <div class="boot-logo">
        ${wyLogo('draw')}
        <div class="boot-company">${config.company}</div>
        <div class="boot-name"></div>
        <div class="boot-long">${config.computerLong}</div>
        <div class="boot-bar"></div>
        <div class="boot-msg">INITIALIZING</div>
      </div>`;
    await sleep(1500);

    const name = root.querySelector('.boot-name');
    for (const ch of config.computer) {
      if (skipped) break;
      name.textContent += ch;
      sound.beep();
      await sleep(90);
    }

    const bar = root.querySelector('.boot-bar');
    for (let i = 0; i < 28 && !skipped; i++) {
      bar.insertAdjacentHTML('beforeend', '<i></i>');
      sound.tick();
      await sleep(45 + Math.random() * 60);
    }
    const msg = root.querySelector('.boot-msg');
    if (msg) msg.innerHTML = 'CONNECTION TO STATION NETWORK <span class="mint">ESTABLISHED</span>';
    sound.confirm();
    await sleep(1300);
  }

  removeEventListener('keydown', onSkip);
  removeEventListener('pointerdown', onSkip);
  root.remove();
}

function anyInput() {
  return new Promise((resolve) => {
    const go = (e) => {
      if (e.type === 'keydown' && ['F9', 'F10', 'F11', 'F12'].includes(e.key)) return;
      removeEventListener('keydown', go);
      removeEventListener('pointerdown', go);
      resolve();
    };
    addEventListener('keydown', go);
    addEventListener('pointerdown', go);
  });
}
