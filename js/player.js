// Spielerkarte (Fernseher/Beamer): zeigt nur, was der GM freigibt. Ausschnitt und Ebene
// kommen von der GM-Karte („Ausschnitt an Spieler“).
import { loadContent } from './content.js';
import { applyZoom } from './stationplan.js';
import { loadTable, onTableChange, drawTable, allLevels, startLevel, PING_MS } from './table.js';

loadContent();
const svg = document.querySelector('#map');
let timer = 0;

function render() {
  const t = loadTable();
  const levels = allLevels();
  const lv = levels.find((l) => l.id === t.player?.levelId) || startLevel(levels);
  if (!lv) return;
  drawTable(svg, lv, t, 'player');
  const b = lv.plan.bounds;
  const vb = t.player?.levelId === lv.id && t.player.vb ? t.player.vb : { x: b[0] - 60, y: b[1] - 60, w: b[2] - b[0] + 120, h: b[3] - b[1] + 120 };
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  applyZoom(svg, vb.w / (svg.clientWidth || 1600));
  document.querySelector('#plevel').textContent = `${lv.mapName} // ${lv.plan.name}`;
  // abgelaufene Pings ausblenden
  clearTimeout(timer);
  const next = t.pings.filter((p) => !p.keep).map((p) => p.t + PING_MS - Date.now()).filter((ms) => ms > 0);
  if (next.length) timer = setTimeout(render, Math.min(...next) + 50);
}

const full = document.querySelector('#pfull');
full.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
});
let hide = 0;
addEventListener('pointermove', () => { full.classList.add('show'); clearTimeout(hide); hide = setTimeout(() => full.classList.remove('show'), 2500); });
addEventListener('resize', render);
onTableChange(render);
render();
window.__apolloReady = true;
