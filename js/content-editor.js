// Inhalts-Editor: alle Texte des Terminals (Reiter in der Fußleiste des Editors).
import { currentContent, saveContent, defaultContent, CONTENT_KEY, loadContent } from './content.js';
import { STATUS } from './layer.js';
import { drawStarmapLayer, S as SM_S } from './starmap.js';
import { STARMAP } from './starmap-data.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Reihenfolge der Reiter im Editor ('map' = Karten-Editor des Stationsplans)
export const CONTENT_TABS = [
  ['general', 'ALLGEMEIN'],
  ['menu', 'MENÜ'],
  ['map', 'STATION'],
  ['stars', 'STERN'],
  ['system', 'SYSTEM'],
  ['moon', 'MOND'],
  ['damage', 'SCHÄDEN'],
  ['reports', 'BERICHTE'],
  ['people', 'PERSONAL'],
  ['commlog', 'KOMMLOG'],
  ['systems', 'SYSTEME'],
  ['selfdestruct', 'SELBSTZERSTÖRUNG'],
];

const ACCESS_OPTS = [['green', 'GRÜN'], ['orange', 'ORANGE'], ['red', 'ROT'], ['mainframe', 'NUR MAINFRAME']];
const MSG_ACCESS = ACCESS_OPTS.slice(0, 3);
const SENT_OPTS = [['true', 'VERSENDET'], ['false', 'NICHT VERSENDET']];

const STATES = [['', 'NORMAL'], ['warn', 'WARNUNG'], ['crit', 'KRITISCH']];
const BLOCK_TYPES = [['text', 'TEXT'], ['alert', 'WARNMELDUNG'], ['table', 'TABELLE'], ['meter', 'BALKENANZEIGE']];

// ---------- Pfad-Helfer ----------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => { if (o[k] == null) o[k] = {}; return o[k]; }, obj);
  target[last] = value;
}

const CONV = {
  text: { get: (v) => v ?? '', set: (v) => v },
  num: { get: (v) => v ?? '', set: (v) => (v === '' ? '' : Number(String(v).replace(',', '.'))) },
  csv: { get: (v) => (v || []).join(', '), set: (v) => v.split(',').map((x) => x.trim()).filter(Boolean) },
  lines: { get: (v) => (v || []).join('\n'), set: (v) => v.split('\n') },
  rows: { get: (v) => (v || []).map((r) => r.join(' | ')).join('\n'), set: (v) => v.split('\n').filter((l) => l.trim()).map((l) => l.split('|').map((x) => x.trim())) },
  bool: { get: (v) => !!v, set: (v) => v },
  boolsel: { get: (v) => String(v !== false), set: (v) => v === 'true' },
};

// ---------- Bausteine ----------

const input = (label, path, conv = 'text', extra = '') => `<label class="ed-field">${label}<input type="text" data-path="${path}" data-conv="${conv}" ${extra}></label>`;
const area = (label, path, conv = 'text', rows = 3, hint = '') => `<label class="ed-field">${label}${hint ? ` <span class="dim">${hint}</span>` : ''}<textarea rows="${rows}" data-path="${path}" data-conv="${conv}"></textarea></label>`;
const select = (label, path, options, conv = 'text') => `<label class="ed-field">${label}<select data-path="${path}" data-conv="${conv}">${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
const head = (t) => `<div class="ed-head">${t}</div>`;
const note = (t) => `<p class="ed-note">${t}</p>`;
const del = (path) => `<button class="danger ed-x" data-del="${path}" title="Entfernen">✕</button>`;
const add = (path, tpl, text = '+ HINZUFÜGEN') => `<button data-add="${path}" data-tpl='${esc(JSON.stringify(tpl))}'>${text}</button>`;

const imageRow = (path, img) => `<div class="ed-crow ed-imgrow">
  <div class="ed-thumb">${img ? `<img src="${esc(img)}" alt="">` : '<span class="dim">KEIN BILD</span>'}</div>
  <button data-upload="${path}">BILD HOCHLADEN …</button>
  ${img ? `<button class="danger" data-noimg="${path}">BILD ENTFERNEN</button>` : ''}
</div>`;

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

export function createContentEditor(root, { getLevel, getLayer, setRoomStatus, toast }) {
  let c = currentContent();
  let tab = 'general';
  let topicIdx = 0;
  let saveTimer = 0;

  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveContent(c), 250);
  };

  const roomOptions = () => [['', '– KEIN RAUM –'], ...getLevel().rooms.map((r) => [r.id, r.id])];

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
          ${head('INFOKASTEN OBEN RECHTS (ZWEITE ZEILE)')}
          ${input('KENNUNG', 'config.infoCode')}
          ${input('DATUM', 'config.date')}
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
          ${head('INTERKOMM')}
          ${area('SIMULIERTE ANTWORTEN', 'replies', 'lines', 5, '{name} = Name der Person')}
        </section>
      </div>`,

    stars: () => `
      <section class="ed-smwrap">
        ${head('SYSTEME & SEKTOREN BENENNEN')}
        ${note('Stern oder Sektorfeld in der Karte anklicken (Mausrad = Zoom, ziehen = bewegen) oder direkt in der Liste eintragen. Leere Sektoren zeigen „NO DATA“, unbenannte Sterne bleiben ohne Beschriftung.')}
        <div class="ed-smgrid">
          <div class="ed-smmap"><svg id="sm-prev" xmlns="http://www.w3.org/2000/svg"></svg></div>
          <div class="ed-smlist">
            <div class="ed-head">SEKTOREN</div>
            ${STARMAP.sectors.map((sec, i) => `<div class="ed-crow ed-smrow" data-smrow="${sec.id}">
              <span class="ed-smno">${sec.target ? '★' : `S${i + 1}`}</span>
              ${input('', `config.starmap.sectors.${sec.id}`, 'text', `placeholder="${sec.target ? esc(c.config.sector) : 'NO DATA'}" data-smredraw`)}</div>`).join('')}
            <div class="ed-head">STERNENSYSTEME</div>
            ${STARMAP.systems.map((sys) => `<div class="ed-crow ed-smrow" data-smrow="${sys.id}">
              <span class="ed-smno">${sys.id === STARMAP.targetId ? '★' : sys.id.slice(1)}</span>
              ${input('', `config.starmap.systems.${sys.id}.name`, 'text', `placeholder="${sys.id === STARMAP.targetId ? esc(c.config.star) : 'NAME'}" data-smredraw`)}
              ${input('', `config.starmap.systems.${sys.id}.sub`, 'text', 'placeholder="ZUSATZ (Z. B. KOLONIE)" data-smredraw')}</div>`).join('')}
          </div>
        </div>
      </section>
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
      const level = getLevel();
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
      const kind = { report: '', damage: '· SCHADEN', map: '· KARTE', interkom: '· INTERKOMM', help: '· HILFE', commlog: '· KOMMLOG', systems: '· SYSTEME', selfdestruct: '· SELBSTZERSTÖRUNG' };
      const infos = t.infos || [];
      return `
      <div class="ed-cgrid wide-right">
        <section>
          ${head('KATEGORIEN')}
          <div class="ed-tlist">${list.map(({ t: x, i }) => `<button class="ed-tsel ${i === topicIdx ? 'on' : ''}" data-topic="${i}">${esc(x.title || x.id)} <span class="dim">${kind[x.view] || ''}${x.infos?.length ? ` · ${x.infos.length} INFO${x.infos.length > 1 ? 'S' : ''}` : ''}</span></button>`).join('')}</div>
          <div class="ed-btns">${add('topics', { id: `custom-${Date.now().toString(36)}`, title: 'NEUE KATEGORIE', view: 'report', access: 'orange', example: '', keywords: [], weak: [], blocks: [{ type: 'text', text: '' }], infos: [] }, '+ NEUE KATEGORIE')}</div>
          ${note('<b>So funktioniert die freie Eingabe:</b> Tippt jemand im Terminal eine Frage ein, vergleicht A.P.O.L.L.O. die Wörter mit den Schlüsselwörtern aller Kategorien und aller Infos. Der beste Treffer wird angezeigt. Eine eingetragene Frage, die genau so eingetippt wird, gewinnt immer.')}
          ${note('<b>Kategorie</b> = Menüpunkt bzw. Themenbereich. Ihr Hauptinhalt erscheint bei allgemeinen Fragen und über das Menü. <b>Infos</b> = zusätzliche Antworten innerhalb einer Kategorie für speziellere Fragen.')}
          ${note('Neue Kategorien kommen über den Reiter MENÜ ins Hauptmenü.')}
        </section>
        <section>
          ${head(`KATEGORIE: ${esc(t.title || t.id)}`)}
          <div class="ed-crow">
            ${input('TITEL', `${base}.title`)}
            ${select('ZUGANGSSTUFE', `${base}.access`, ACCESS_OPTS)}
          </div>
          ${input('BEISPIELFRAGE (ERSCHEINT IN DER HILFE)', `${base}.example`)}
          ${area('SCHLÜSSELWÖRTER', `${base}.keywords`, 'csv', 2, 'durch Komma getrennt · Wortanfänge reichen')}
          ${area('SCHWACHE HINWEISE', `${base}.weak`, 'csv', 1, 'zählen weniger')}
          ${head('HAUPTINHALT')}
          ${t.view === 'report' ? `${(t.blocks || []).map((b, i) => blockEditor(`${base}.blocks.${i}`, b, i, t.blocks.length)).join('')}
            <div class="ed-btns">${add(`${base}.blocks`, { type: 'text', text: '' }, '+ BAUSTEIN')}</div>` : note({ damage: 'Der Hauptinhalt ist der Schadensbericht (Reiter SCHÄDEN).', commlog: 'Der Hauptinhalt ist die Nachrichtenliste (Reiter KOMMLOG).', systems: 'Der Hauptinhalt sind die Schaltflächen (Reiter SYSTEME).', selfdestruct: 'Der Hauptinhalt ist die Selbstzerstörung (Reiter SELBSTZERSTÖRUNG).' }[t.view] || 'Der Hauptinhalt dieser Kategorie ist eine eigene Ansicht (Karte, Interkomm oder Hilfe). Zusätzliche Antworten trägst du unten als Infos ein.')}
          ${head(`ZUSÄTZLICHE INFOS (${infos.length})`)}
          ${note('Jede Info hat eigene Fragen und Schlüsselwörter und gibt einen oder mehrere Inhaltsbausteine aus. Beispiel unter PERSONALREGISTER: Info „DR. REYES“ mit der Frage „WER IST DR. REYES?“ und den Schlüsselwörtern „reyes, elena“.')}
          ${infos.map((inf, k) => {
            const ib = `${base}.infos.${k}`;
            return `<div class="ed-info">
              <div class="ed-crow">
                ${input(`INFO ${k + 1} – TITEL`, `${ib}.title`)}
                ${select('ZUGANG', `${ib}.access`, [['', 'WIE KATEGORIE'], ...ACCESS_OPTS])}
                <button data-move="${ib}" data-dir="-1" ${k === 0 ? 'disabled' : ''}>↑</button><button data-move="${ib}" data-dir="1" ${k === infos.length - 1 ? 'disabled' : ''}>↓</button>
                ${del(ib)}
              </div>
              <div class="ed-crow">
                ${area('FRAGEN', `${ib}.questions`, 'lines', 2, 'eine Frage pro Zeile')}
                ${area('SCHLÜSSELWÖRTER', `${ib}.keywords`, 'csv', 2, 'durch Komma getrennt')}
              </div>
              <div class="ed-ihead">AUSGABE</div>
              ${(inf.blocks || []).map((b, i) => blockEditor(`${ib}.blocks.${i}`, b, i, inf.blocks.length)).join('')}
              <div class="ed-btns">${add(`${ib}.blocks`, { type: 'text', text: '' }, '+ BAUSTEIN')}</div>
            </div>`;
          }).join('')}
          <div class="ed-btns">${add(`${base}.infos`, { title: 'NEUE INFO', access: '', questions: [], keywords: [], blocks: [{ type: 'text', text: '' }] }, '+ INFO HINZUFÜGEN')}</div>
          ${String(t.id).startsWith('custom-') ? `<div class="ed-btns"><button class="danger" data-del="${base}">KATEGORIE LÖSCHEN</button></div>` : ''}
        </section>
      </div>`;
    },

    menu: () => `
      <section class="ed-cone">
        ${head('HAUPTMENÜ')}
        ${note('Die Tasten A, B, C … vergibt das Terminal automatisch nach den Punkten, die die angemeldete Zugangsstufe sehen darf. Die Zugangsstufe gilt für die Kategorie – auch bei freier Eingabe.')}
        ${(c.menu || []).map((m, i) => {
          const ti = c.topics.findIndex((t) => t.id === m.topic);
          return `<div class="ed-crow">
          ${input('BEZEICHNUNG', `menu.${i}.label`)}
          ${select('ÖFFNET', `menu.${i}.topic`, c.topics.map((t) => [t.id, t.title || t.id]))}
          ${ti >= 0 ? select('ZUGANG', `topics.${ti}.access`, ACCESS_OPTS) : ''}
          <button data-move="menu.${i}" data-dir="-1" title="Nach oben">↑</button><button data-move="menu.${i}" data-dir="1" title="Nach unten">↓</button>
          ${del(`menu.${i}`)}</div>`;
        }).join('')}
        <div class="ed-btns">${add('menu', { label: 'NEU', topic: c.topics[0]?.id || '' })}</div>
        ${head('ZUGANGSSTUFEN')}
        ${note('<b>GRÜN</b>: Gast oder niedrige Stufe · <b>ORANGE</b>: Personal · <b>ROT</b>: Leitung · <b>NUR MAINFRAME</b>: nur bei Anmeldung direkt am Mainframe im Computerraum (Stufe Rot inklusive).')}
      </section>`,

    people: () => `
      <section class="ed-cone">
        ${head('STATIONSBEWOHNER (INTERKOMM)')}
        ${(c.personnel || []).map((p, i) => `<div class="ed-person">
          <div class="ed-crow">
            ${input('NAME', `personnel.${i}.name`)}
            ${input('FUNKTION', `personnel.${i}.role`)}
            ${input('STANDORT', `personnel.${i}.location`)}
            <label class="ed-field ed-checkf"><input type="checkbox" data-path="personnel.${i}.available" data-conv="bool"> ERREICHBAR</label>
            <button data-move="personnel.${i}" data-dir="-1">↑</button><button data-move="personnel.${i}" data-dir="1">↓</button>
            ${del(`personnel.${i}`)}
          </div>
          ${imageRow(`personnel.${i}.image`, p.image)}
        </div>`).join('')}
        <div class="ed-btns">${add('personnel', { name: 'NEUE PERSON', role: '', location: '', available: true, image: '' })}</div>
      </section>`,

    commlog: () => `
      <section class="ed-cone">
        ${head('KOMMLOG – EIN- UND AUSGEHENDE KOMMUNIKATION')}
        ${note('Nachrichten mit höherer Zugangsstufe sind für niedrigere Stufen unsichtbar. Ohne eigenes Bild wird das Bild der gleichnamigen Person aus PERSONAL verwendet.')}
        ${(c.commlog || []).map((m, i) => `<div class="ed-person">
          <div class="ed-crow">
            ${input('DATUM', `commlog.${i}.date`, 'text', 'placeholder="2183.03.14"')}
            ${input('UHRZEIT', `commlog.${i}.time`, 'text', 'placeholder="17:55"')}
            ${select('ZUGANG', `commlog.${i}.access`, MSG_ACCESS)}
            ${select('STATUS', `commlog.${i}.sent`, SENT_OPTS, 'boolsel')}
            <button data-move="commlog.${i}" data-dir="-1">↑</button><button data-move="commlog.${i}" data-dir="1">↓</button>
            ${del(`commlog.${i}`)}
          </div>
          <div class="ed-crow">
            ${input('SENDER', `commlog.${i}.from`)}
            ${input('EMPFÄNGER', `commlog.${i}.to`)}
          </div>
          ${input('BETREFF', `commlog.${i}.subject`)}
          ${area('NACHRICHT', `commlog.${i}.text`, 'text', 4)}
          ${imageRow(`commlog.${i}.image`, m.image)}
        </div>`).join('')}
        <div class="ed-btns">${add('commlog', { date: '2183.01.01', time: '12:00', from: '', to: '', subject: 'NEUE NACHRICHT', access: 'orange', sent: true, image: '', text: '' }, '+ NACHRICHT')}</div>
      </section>`,

    systems: () => `
      <section class="ed-cone">
        ${head('ZUGRIFF STATIONSSYSTEME – SCHALTFLÄCHEN')}
        ${note('Platzhalter ohne Funktion. Reihenfolge = Reihenfolge im Raster (vier pro Zeile).')}
        ${(c.systems || []).map((n, i) => `<div class="ed-crow">
          ${input(`FELD ${i + 1}`, `systems.${i}`)}
          <button data-move="systems.${i}" data-dir="-1">↑</button><button data-move="systems.${i}" data-dir="1">↓</button>
          ${del(`systems.${i}`)}</div>`).join('')}
        <div class="ed-btns">${add('systems', 'NEUES SYSTEM')}</div>
      </section>`,

    selfdestruct: () => `
      <div class="ed-cgrid">
        <section>
          ${head('ABFRAGE')}
          ${area('EINLEITUNG', 'selfdestruct.intro', 'lines', 3, 'eine Zeile pro Meldung')}
          ${input('CODE-ABFRAGE', 'selfdestruct.codePrompt')}
          ${input('CODE ANGENOMMEN', 'selfdestruct.codeOk')}
          ${input('SICHERHEITSFRAGE', 'selfdestruct.confirm')}
          ${input('ABBRUCH (BEI „NEIN“)', 'selfdestruct.cancelled')}
          ${note('Jeder eingegebene Code wird akzeptiert. Mit „JA“ startet die Sequenz.')}
        </section>
        <section>
          ${head('SEQUENZ')}
          ${area('MELDUNGEN', 'selfdestruct.sequence', 'lines', 6, 'eine Zeile pro Meldung')}
          ${input('COUNTDOWN (MINUTEN)', 'selfdestruct.minutes', 'num')}
          ${input('COUNTDOWN-BESCHRIFTUNG', 'selfdestruct.countdownLabel')}
          ${input('TEXT NACH DER DETONATION', 'selfdestruct.final')}
          ${note('Abbrechen im Terminal: im Selbstzerstörungs-Fenster ABBRUCH eingeben (danach Code). Neu laden setzt alles zurück.')}
        </section>
      </div>`,
  };

  // Vorschau der Sternenkarte im Reiter STERNENKARTE
  let smVB = null;
  let smSel = null;
  function starPreview() {
    const svg = root.querySelector('#sm-prev');
    if (!svg) return;
    const [x0, y0, x1, y1] = STARMAP.frame.map((v) => v * SM_S);
    if (!smVB) smVB = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const setVB = () => svg.setAttribute('viewBox', `${smVB.x} ${smVB.y} ${smVB.w} ${smVB.h}`);
    const draw = () => {
      svg.replaceChildren();
      const ns = 'http://www.w3.org/2000/svg';
      const g = document.createElementNS(ns, 'g');
      svg.appendChild(g);
      const nodes = drawStarmapLayer(g, c.config, { editor: true });
      if (smSel && nodes[smSel]) nodes[smSel].classList.add('sel');
    };
    const pick = (id) => {
      smSel = id;
      svg.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
      svg.querySelector(`[data-sys="${id}"], [data-sec="${id}"]`)?.classList.add('sel');
      root.querySelectorAll('.ed-smrow').forEach((r) => r.classList.toggle('on', r.dataset.smrow === id));
      const row = root.querySelector(`[data-smrow="${id}"]`);
      if (row) { row.scrollIntoView({ block: 'center' }); row.querySelector('input')?.focus(); }
    };
    setVB();
    draw();
    let drag = null;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
      const s = Math.max(smVB.w / r.width, smVB.h / r.height);
      const mx = smVB.x + (e.clientX - r.left - (r.width - smVB.w / s) / 2) * s;
      const my = smVB.y + (e.clientY - r.top - (r.height - smVB.h / s) / 2) * s;
      const w = Math.min(x1 - x0, Math.max(200, smVB.w * k));
      const f = w / smVB.w;
      smVB = { x: mx - (mx - smVB.x) * f, y: my - (my - smVB.y) * f, w, h: smVB.h * f };
      setVB();
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vb: { ...smVB }, moved: false }; });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = svg.getBoundingClientRect();
      const s = Math.max(smVB.w / r.width, smVB.h / r.height);
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { smVB = { ...drag.vb, x: drag.vb.x - dx * s, y: drag.vb.y - dy * s }; setVB(); }
    });
    svg.addEventListener('pointerup', (e) => {
      const d = drag;
      drag = null;
      if (!d || d.moved) return;
      const hit = e.target.closest('[data-sys], [data-sec]');
      if (hit) pick(hit.dataset.sys || hit.dataset.sec);
    });
    svg.addEventListener('pointerleave', () => { drag = null; });
    root.querySelectorAll('[data-smredraw]').forEach((inp) => {
      inp.addEventListener('input', () => draw());
      inp.addEventListener('focus', () => {
        const id = inp.closest('[data-smrow]').dataset.smrow;
        if (smSel !== id) { smSel = id; draw(); root.querySelectorAll('.ed-smrow').forEach((r) => r.classList.toggle('on', r.dataset.smrow === id)); }
      });
    });
    if (smSel) root.querySelector(`[data-smrow="${smSel}"]`)?.classList.add('on');
  }

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
        if (el.tagName === 'SELECT' && /\.(type|room|topic)$/.test(el.dataset.path)) render();
      });
    });
    if (tab === 'stars') starPreview();
    root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      let list = getPath(c, b.dataset.add);
      if (!Array.isArray(list)) { list = []; setPath(c, b.dataset.add, list); }
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
          setPath(c, b.dataset.upload, await shrinkImage(f.files[0]));
          saveContent(c);
          render();
          toast('BILD GESPEICHERT');
        } catch { toast('BILD KONNTE NICHT GELESEN WERDEN'); }
      };
      f.click();
    }));
    root.querySelectorAll('[data-noimg]').forEach((b) => b.addEventListener('click', () => {
      setPath(c, b.dataset.noimg, '');
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
        for (const k of ['computer', 'computerLong', 'model', 'company', 'year', 'terminalId', 'infoCode', 'date', 'station', 'stationCode', 'moon', 'planet', 'star', 'system', 'sector', 'greeting', 'readouts', 'boot']) c.config[k] = d.config[k];
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
      if (tab === 'commlog') c.commlog = d.commlog;
      if (tab === 'systems') c.systems = d.systems;
      if (tab === 'selfdestruct') c.selfdestruct = d.selfdestruct;
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
