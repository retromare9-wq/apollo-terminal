// Inhalts-Editor: alle Texte des Terminals (Reiter in der Fußleiste des Editors).
import { currentContent, saveContent, defaultContent, CONTENT_KEY, loadContent } from './content.js';
import { STATUS } from './layer.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CONTENT_TABS = [
  ['general', 'ALLGEMEIN'],
  ['stars', 'STERNENKARTE'],
  ['system', 'SYSTEMKARTE'],
  ['moon', 'MONDKARTE'],
  ['damage', 'SCHADENSBERICHT'],
  ['reports', 'BERICHTE'],
  ['menu', 'MENÜ'],
  ['people', 'PERSONAL'],
];

const STATES = [['', 'NORMAL'], ['warn', 'WARNUNG'], ['crit', 'KRITISCH']];
const BLOCK_TYPES = [['text', 'TEXT'], ['alert', 'WARNMELDUNG'], ['table', 'TABELLE'], ['meter', 'BALKENANZEIGE']];

// ---------- Pfad-Helfer ----------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

const CONV = {
  text: { get: (v) => v ?? '', set: (v) => v },
  num: { get: (v) => v ?? '', set: (v) => (v === '' ? '' : Number(String(v).replace(',', '.'))) },
  csv: { get: (v) => (v || []).join(', '), set: (v) => v.split(',').map((x) => x.trim()).filter(Boolean) },
  lines: { get: (v) => (v || []).join('\n'), set: (v) => v.split('\n') },
  rows: { get: (v) => (v || []).map((r) => r.join(' | ')).join('\n'), set: (v) => v.split('\n').filter((l) => l.trim()).map((l) => l.split('|').map((x) => x.trim())) },
  bool: { get: (v) => !!v, set: (v) => v },
};

// ---------- Bausteine ----------

const input = (label, path, conv = 'text', extra = '') => `<label class="ed-field">${label}<input type="text" data-path="${path}" data-conv="${conv}" ${extra}></label>`;
const area = (label, path, conv = 'text', rows = 3, hint = '') => `<label class="ed-field">${label}${hint ? ` <span class="dim">${hint}</span>` : ''}<textarea rows="${rows}" data-path="${path}" data-conv="${conv}"></textarea></label>`;
const select = (label, path, options) => `<label class="ed-field">${label}<select data-path="${path}" data-conv="text">${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
const head = (t) => `<div class="ed-head">${t}</div>`;
const note = (t) => `<p class="ed-note">${t}</p>`;
const del = (path) => `<button class="danger ed-x" data-del="${path}" title="Entfernen">✕</button>`;
const add = (path, tpl, text = '+ HINZUFÜGEN') => `<button data-add="${path}" data-tpl='${esc(JSON.stringify(tpl))}'>${text}</button>`;

// Bild auf höchstens 320 px verkleinern und als JPEG-Daten speichern (passt in den Browser-Speicher)
function shrinkImage(file, max = 320) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}

export function createContentEditor(root, { level, getLayer, setRoomStatus, toast }) {
  let c = currentContent();
  let tab = 'general';
  let topicIdx = 0;
  let saveTimer = 0;

  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveContent(c), 250);
  };

  const roomOptions = () => [['', '– KEIN RAUM –'], ...level.rooms.map((r) => [r.id, r.id])];

  // ---------- Reiter ----------

  const TABS = {
    general: () => `
      <div class="ed-cgrid">
        <section>
          ${head('COMPUTER & BETREIBER')}
          ${input('NAME DES COMPUTERS', 'config.computer')}
          ${input('AUSGESCHRIEBEN', 'config.computerLong')}
          ${input('MODELL', 'config.model')}
          ${input('BETREIBER', 'config.company')}
          ${input('JAHR', 'config.year', 'num')}
          ${input('TERMINAL-KENNUNG', 'config.terminalId')}
          ${head('ORTE')}
          ${input('STATION (VOLLER NAME)', 'config.station')}
          ${input('STATIONSKÜRZEL', 'config.stationCode')}
          ${input('MOND', 'config.moon')}
          ${input('PLANET', 'config.planet')}
          ${input('STERN', 'config.star')}
          ${input('SYSTEM', 'config.system')}
          ${input('SEKTOR', 'config.sector')}
        </section>
        <section>
          ${head('HAUPTMENÜ')}
          ${area('BEGRÜSSUNG', 'config.greeting', 'text', 3)}
          ${head('STATUSANZEIGE RECHTS IM MENÜ')}
          ${(c.config.readouts || []).map((r, i) => `<div class="ed-crow">
            ${input('BEZEICHNUNG', `config.readouts.${i}.label`)}
            ${input('WERT', `config.readouts.${i}.value`)}
            ${select('FARBE', `config.readouts.${i}.state`, STATES)}
            ${del(`config.readouts.${i}`)}</div>`).join('')}
          <div class="ed-btns">${add('config.readouts', { label: 'NEU', value: '', state: '' })}</div>
          ${head('STARTSEQUENZ')}
          ${area('ZEILEN DES SYSTEMCHECKS', 'config.boot', 'lines', 14, 'eine Zeile pro Meldung')}
          ${head('INTERKOM')}
          ${area('SIMULIERTE ANTWORTEN', 'replies', 'lines', 5, '{name} = Name der Person')}
        </section>
      </div>`,

    stars: () => `
      <div class="ed-cgrid">
        <section>
          ${head('STERNENKARTE')}
          ${input('SEKTOR-FELD AUF DER KARTE', 'config.sector')}
          ${input('ENTFERNUNG ZU SOL (PARSEC)', 'config.starmap.distancePc', 'num')}
          ${input('EINRASTEN – ZEILE 1', 'config.starLock.0')}
          ${input('EINRASTEN – ZEILE 2', 'config.starLock.1')}
          ${head('LEGENDE')}
          ${(c.config.starmap.legend || []).map((l, i) => `<div class="ed-crow">
            ${input(`EINTRAG ${i + 1}`, `config.starmap.legend.${i}.1`)}
            ${input('UNTERZEILE', `config.starmap.legend.${i}.2`)}</div>`).join('')}
        </section>
        <section>
          ${head('POSITIONSDATEN (PANEL RECHTS)')}
          ${(c.config.starmap.rows || []).map((r, i) => `<div class="ed-crow">
            ${input('BEZEICHNUNG', `config.starmap.rows.${i}.0`)}
            ${input('WERT', `config.starmap.rows.${i}.1`)}
            ${del(`config.starmap.rows.${i}`)}</div>`).join('')}
          <div class="ed-btns">${add('config.starmap.rows', ['', ''])}</div>
          ${note('Wörter wie WARNUNG, CONTESTED oder KRITISCH werden automatisch eingefärbt.')}
        </section>
      </div>`,

    system: () => `
      <div class="ed-cgrid">
        <section>
          ${head('UMLAUFBAHNEN (VON INNEN NACH AUSSEN)')}
          ${(c.config.systemmap.planets || []).map((p, i) => input(i === 2 ? 'BAHN 3 – GASRIESE MIT MOND' : `BAHN ${i + 1}`, `config.systemmap.planets.${i}`)).join('')}
          ${note('Leere Felder lassen den Planeten unbeschriftet.')}
        </section>
        <section>
          ${head('ZIELERFASSUNG')}
          ${input('EINRASTEN – ZEILE 1', 'config.systemmap.lock.0')}
          ${input('EINRASTEN – ZEILE 2', 'config.systemmap.lock.1')}
          ${input('KOORDINATENZEILE', 'config.systemmap.coord')}
        </section>
      </div>`,

    moon: () => `
      <div class="ed-cgrid">
        <section>
          ${head('DATENZEILEN LINKS')}
          ${area('ZEILEN', 'config.moonmap.rows', 'lines', 8, 'eine Zeile pro Wert')}
        </section>
        <section>
          ${head('ZIELERFASSUNG (STATION)')}
          ${input('EINRASTEN – ZEILE 1', 'config.moonmap.lock.0')}
          ${input('EINRASTEN – ZEILE 2', 'config.moonmap.lock.1')}
          ${input('KOORDINATENZEILE', 'config.moonmap.coord')}
        </section>
      </div>`,

    damage: () => {
      const ti = c.topics.findIndex((t) => t.view === 'damage');
      if (ti < 0) return note('Kein Schadensbericht vorhanden.');
      const base = `topics.${ti}.damage`;
      const d = c.topics[ti].damage;
      const layer = getLayer();
      const statusRooms = level.rooms.filter((r) => layer.rooms[r.id]?.status);
      return `
      <div class="ed-cgrid">
        <section>
          ${head('BERICHT')}
          ${input('TITEL', `topics.${ti}.title`)}
          ${area('EINLEITUNG', `${base}.intro`, 'text', 2)}
          ${input('BEZEICHNUNG HÜLLENANZEIGE', `${base}.hullLabel`)}
          ${input('HÜLLENINTEGRITÄT (%)', `${base}.hull`, 'num')}
          ${area('EMPFEHLUNG', `${base}.recommendation`, 'text', 3)}
          ${area('TEXT, WENN KEINE SCHÄDEN', `${base}.none`, 'text', 2)}
          ${head('RÄUME MIT STATUS (AUS DEM KARTEN-EDITOR)')}
          ${statusRooms.length ? statusRooms.map((r) => `<div class="ed-crow"><span class="ed-cname">${esc(r.id)}</span>
            <select data-roomstatus="${esc(r.id)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${layer.rooms[r.id]?.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')
            : note('Noch kein Raum mit Status. Status setzt du hier in einem Fall oder im Karten-Editor.')}
        </section>
        <section>
          ${head('FÄLLE')}
          ${note('Mit Raum: Der Status wird direkt in den Stationsplan übernommen. Ohne Raum: freie Meldung mit eigenem Status.')}
          ${(d.cases || []).map((cs, i) => {
            const room = cs.room && level.rooms.find((r) => r.id === cs.room);
            const st = room ? layer.rooms[room.id]?.status || '' : cs.status || '';
            return `<div class="ed-case">
              <div class="ed-crow">
                ${select('RAUM', `${base}.cases.${i}.room`, roomOptions())}
                <label class="ed-field">STATUS<select data-casestatus="${i}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
                ${del(`${base}.cases.${i}`)}
              </div>
              ${input('BEZEICHNUNG IM BERICHT', `${base}.cases.${i}.title`, 'text', room ? 'placeholder="Raumname wird verwendet"' : '')}
              ${area('MELDUNG', `${base}.cases.${i}.text`, 'text', 2)}
            </div>`;
          }).join('')}
          <div class="ed-btns">${add(`${base}.cases`, { room: '', title: '', status: 'warn', text: '' }, '+ FALL HINZUFÜGEN')}</div>
        </section>
      </div>`;
    },

    reports: () => {
      const list = c.topics.map((t, i) => ({ t, i }));
      if (topicIdx >= c.topics.length) topicIdx = 0;
      const t = c.topics[topicIdx];
      const base = `topics.${topicIdx}`;
      return `
      <div class="ed-cgrid wide-right">
        <section>
          ${head('KATEGORIEN')}
          <div class="ed-tlist">${list.map(({ t: x, i }) => `<button class="ed-tsel ${i === topicIdx ? 'on' : ''}" data-topic="${i}">${esc(x.title || x.id)} <span class="dim">${{ report: '', damage: '· SCHADEN', map: '· KARTE', interkom: '· INTERKOM', help: '· HILFE' }[x.view] || ''}</span></button>`).join('')}</div>
          <div class="ed-btns">${add('topics', { id: `custom-${Date.now().toString(36)}`, title: 'NEUER BERICHT', view: 'report', example: '', keywords: [], weak: [], blocks: [{ type: 'text', text: '' }] }, '+ NEUER BERICHT')}</div>
          ${note('Neue Berichte erscheinen über die freie Eingabe (Schlüsselwörter). Ins Hauptmenü kommen sie über den Reiter MENÜ.')}
        </section>
        <section>
          ${head(esc(t.title || t.id))}
          ${input('TITEL', `${base}.title`)}
          ${input('BEISPIELFRAGE FÜR DIE HILFE', `${base}.example`)}
          ${area('SCHLÜSSELWÖRTER', `${base}.keywords`, 'csv', 3, 'durch Komma getrennt · Wortanfänge reichen')}
          ${area('SCHWACHE HINWEISE', `${base}.weak`, 'csv', 2, 'zählen weniger')}
          ${t.view === 'report' ? `${head('INHALT')}${(t.blocks || []).map((b, i) => blockEditor(`${base}.blocks.${i}`, b, i, t.blocks.length)).join('')}
            <div class="ed-btns">${add(`${base}.blocks`, { type: 'text', text: '' }, '+ BAUSTEIN')}</div>` : note(t.view === 'damage' ? 'Den Inhalt bearbeitest du im Reiter SCHADENSBERICHT.' : 'Diese Kategorie öffnet eine Ansicht ohne eigenen Text (Karte, Interkom, Hilfe).')}
          ${String(t.id).startsWith('custom-') ? `<div class="ed-btns"><button class="danger" data-del="${base}">BERICHT LÖSCHEN</button></div>` : ''}
        </section>
      </div>`;
    },

    menu: () => `
      <section class="ed-cone">
        ${head('HAUPTMENÜ')}
        ${(c.menu || []).map((m, i) => `<div class="ed-crow">
          ${input('TASTE', `menu.${i}.key`, 'text', 'maxlength="1" class="key"')}
          ${input('BEZEICHNUNG', `menu.${i}.label`)}
          ${select('ÖFFNET', `menu.${i}.topic`, c.topics.map((t) => [t.id, t.title || t.id]))}
          <button data-move="menu.${i}" data-dir="-1" title="Nach oben">↑</button><button data-move="menu.${i}" data-dir="1" title="Nach unten">↓</button>
          ${del(`menu.${i}`)}</div>`).join('')}
        <div class="ed-btns">${add('menu', { key: '', label: 'NEU', topic: c.topics[0]?.id || '' })}</div>
      </section>`,

    people: () => `
      <section class="ed-cone">
        ${head('STATIONSBEWOHNER (INTERKOM)')}
        ${(c.personnel || []).map((p, i) => `<div class="ed-person">
          <div class="ed-crow">
            ${input('NAME', `personnel.${i}.name`)}
            ${input('FUNKTION', `personnel.${i}.role`)}
            ${input('STANDORT', `personnel.${i}.location`)}
            <label class="ed-field ed-checkf"><input type="checkbox" data-path="personnel.${i}.available" data-conv="bool"> ERREICHBAR</label>
            <button data-move="personnel.${i}" data-dir="-1">↑</button><button data-move="personnel.${i}" data-dir="1">↓</button>
            ${del(`personnel.${i}`)}
          </div>
          <div class="ed-crow ed-imgrow">
            <div class="ed-thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : '<span class="dim">KEIN BILD</span>'}</div>
            <button data-upload="${i}">BILD HOCHLADEN …</button>
            ${p.image ? `<button class="danger" data-noimg="${i}">BILD ENTFERNEN</button>` : ''}
          </div>
        </div>`).join('')}
        <div class="ed-btns">${add('personnel', { name: 'NEUE PERSON', role: '', location: '', available: true, image: '' })}</div>
      </section>`,
  };

  function blockEditor(path, b, i, n) {
    const type = select('BAUSTEIN', `${path}.type`, BLOCK_TYPES);
    let body = '';
    if (b.type === 'text' || b.type === 'alert') body = area('TEXT', `${path}.text`, 'text', 3);
    if (b.type === 'meter') body = `<div class="ed-crow">${input('BEZEICHNUNG', `${path}.label`)}${input('WERT (%)', `${path}.value`, 'num')}${select('FARBE', `${path}.state`, STATES)}</div>`;
    if (b.type === 'table') body = `${input('SPALTENKÖPFE', `${path}.head`, 'csv', 'placeholder="durch Komma getrennt"')}${area('ZEILEN', `${path}.rows`, 'rows', 6, 'eine Zeile pro Eintrag, Spalten mit | trennen')}`;
    return `<div class="ed-block"><div class="ed-crow">${type}
      <button data-move="${path}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-move="${path}" data-dir="1" ${i === n - 1 ? 'disabled' : ''}>↓</button>${del(path)}</div>${body}</div>`;
  }

  // ---------- Rendern & Binden ----------

  function render() {
    root.innerHTML = `<div class="ed-cbar"><span class="ed-ctitle">${CONTENT_TABS.find(([k]) => k === tab)[1]}</span>
      <span class="dim">Änderungen werden automatisch gespeichert und erscheinen sofort im Terminal.</span>
      <button data-reset class="danger">REITER AUF VORGABE ZURÜCKSETZEN</button></div>
      <div class="ed-cbody">${TABS[tab]()}</div>`;
    root.querySelectorAll('[data-path]').forEach((el) => {
      const conv = CONV[el.dataset.conv] || CONV.text;
      const v = conv.get(getPath(c, el.dataset.path));
      if (el.type === 'checkbox') el.checked = v; else el.value = v;
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
        setPath(c, el.dataset.path, conv.set(el.type === 'checkbox' ? el.checked : el.value));
        save();
        if (el.tagName === 'SELECT' && /\.(type|room)$/.test(el.dataset.path)) render();
      });
    });
    root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const list = getPath(c, b.dataset.add);
      list.push(JSON.parse(b.dataset.tpl));
      if (b.dataset.add === 'topics') topicIdx = list.length - 1;
      save();
      render();
    }));
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const parts = b.dataset.del.split('.');
      const i = Number(parts.pop());
      const list = getPath(c, parts.join('.'));
      if (parts.join('.') === 'topics') {
        const id = list[i].id;
        c.menu = c.menu.filter((m) => m.topic !== id);
        topicIdx = 0;
      }
      list.splice(i, 1);
      save();
      render();
    }));
    root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      const parts = b.dataset.move.split('.');
      const i = Number(parts.pop());
      const list = getPath(c, parts.join('.'));
      const j = i + Number(b.dataset.dir);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      save();
      render();
    }));
    root.querySelectorAll('[data-upload]').forEach((b) => b.addEventListener('click', () => {
      const f = document.createElement('input');
      f.type = 'file';
      f.accept = 'image/*';
      f.onchange = async () => {
        if (!f.files[0]) return;
        try {
          c.personnel[Number(b.dataset.upload)].image = await shrinkImage(f.files[0]);
          saveContent(c);
          render();
          toast('BILD GESPEICHERT');
        } catch { toast('BILD KONNTE NICHT GELESEN WERDEN'); }
      };
      f.click();
    }));
    root.querySelectorAll('[data-noimg]').forEach((b) => b.addEventListener('click', () => {
      c.personnel[Number(b.dataset.noimg)].image = '';
      saveContent(c);
      render();
    }));
    root.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => { topicIdx = Number(b.dataset.topic); render(); }));
    root.querySelectorAll('[data-roomstatus]').forEach((s) => s.addEventListener('change', () => { setRoomStatus(s.dataset.roomstatus, s.value); render(); }));
    root.querySelectorAll('[data-casestatus]').forEach((s) => s.addEventListener('change', () => {
      const ti = c.topics.findIndex((t) => t.view === 'damage');
      const cs = c.topics[ti].damage.cases[Number(s.dataset.casestatus)];
      if (cs.room) setRoomStatus(cs.room, s.value);
      else { cs.status = s.value; save(); }
      render();
    }));
    root.querySelector('[data-reset]').addEventListener('click', () => {
      if (!confirm('Diesen Reiter auf die Vorgabe zurücksetzen?')) return;
      const d = defaultContent();
      if (tab === 'general') {
        for (const k of ['computer', 'computerLong', 'model', 'company', 'year', 'terminalId', 'station', 'stationCode', 'moon', 'planet', 'star', 'system', 'sector', 'greeting', 'readouts', 'boot']) c.config[k] = d.config[k];
        c.replies = d.replies;
      }
      if (tab === 'stars') { c.config.starmap = d.config.starmap; c.config.starLock = d.config.starLock; }
      if (tab === 'system') c.config.systemmap = d.config.systemmap;
      if (tab === 'moon') c.config.moonmap = d.config.moonmap;
      if (tab === 'damage') {
        const ti = c.topics.findIndex((t) => t.view === 'damage');
        const di = d.topics.findIndex((t) => t.view === 'damage');
        if (ti >= 0 && di >= 0) c.topics[ti] = d.topics[di];
      }
      if (tab === 'reports') { c.topics = d.topics; topicIdx = 0; }
      if (tab === 'menu') c.menu = d.menu;
      if (tab === 'people') c.personnel = d.personnel;
      saveContent(c);
      render();
      toast('ZURÜCKGESETZT');
    });
  }

  addEventListener('storage', (e) => {
    if (e.key === CONTENT_KEY && !root.hidden) { loadContent(); c = currentContent(); render(); }
  });

  return {
    show(t) { tab = t; c = currentContent(); render(); },
    refresh() { c = currentContent(); render(); },
  };
}
