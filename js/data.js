import { LEVEL0 } from './station-level0.js';
import { LAYER0 } from './station-layer0.js';

// Alle Inhalte des Terminals. Texte, Namen und Werte hier ändern –
// der restliche Code muss dafür nicht angefasst werden.
// Wörter wie KRITISCH, WARNUNG oder OFFLINE werden in Berichten automatisch eingefärbt.

export const CONFIG = {
  computer: 'A.P.O.L.L.O.',
  computerLong: 'ADVANCED PLANETARY OPERATIONS, LOGISTICS & LIFE-SUPPORT OVERSIGHT',
  model: 'APOLLO 3000',
  company: 'WEYLAND-YUTANI CORP.',
  year: 2183,
  station: 'ON-TWEX9 OXI-NEROPONTI',
  stationCode: 'ON-TWEX9',
  moon: 'TWEX9',
  planet: 'CARPENTER 74',
  star: 'DS282',
  system: 'DS282 SYSTEM',
  sector: 'BORODINO SECTOR',
  terminalId: 'T-01',
  // Sternenkarte: Datenpanel und Legende
  starmap: {
    distancePc: 38.41,
    rows: [
      ['SECTOR', 'BORODINO SECTOR'],
      ['SYSTEM', 'DS282 // K3 V'],
      ['DIST. SOL', '38.41 PC · 125.3 LY'],
      ['SIGNAL LAG', '125 Y 04 M'],
      ['FTL TRANSIT', '≈ 7 MONATE · CRYO'],
      ['JURISDICTION', 'CONTESTED'],
    ],
    legend: [
      ['dots', 'THE INDEPENDENT CORE SYSTEM COLONIES'],
      ['plain', 'THE THREE WORLD EMPIRE', 'ANGLO-JAPANESE ARM'],
      ['solid', 'THE UNION OF PROGRESSIVE PEOPLES'],
      ['stripes', 'THE UNITED AMERICAS', 'AMERICAN ARM'],
      ['hatch', 'THE FRONTIER'],
    ],
  },
  // Sternenkarte: Beschriftungen beim Einrasten
  starLock: ['TARGET LOCKED', 'DS282'],
  // Systemkarte: Namen der sechs Umlaufbahnen von innen nach außen; die dritte ist der Gasriese
  systemmap: {
    planets: ['DS282-I', 'DS282-II', 'CARPENTER 74', 'DS282-IV', 'DS282-V', 'DS282-VI'],
    lock: ['TARGET LOCKED', 'TWEX9'],
    coord: 'CARPENTER 74 // ORBIT',
  },
  // Mondkarte: Datenzeilen links und Beschriftungen beim Einrasten
  moonmap: {
    rows: ['PRIMARY CARPENTER 74', 'LAT   32.14 N', 'LON  118.07 E', 'GRAV   0.38 G', 'ATM    NONE', 'TEMP  -142 °C'],
    lock: ['TARGET LOCKED', 'ON-TWEX9'],
    coord: 'DEC 0084 6402',
  },
  // Startsequenz (Zeilen des Systemchecks)
  boot: [
    'WEYLAND-YUTANI CORP.  //  SYSTEMS DIVISION',
    'APOLLO 3000 SERIES   BIOS REV 4.12   (C) 2183',
    '',
    'MEMORY TEST ............................. 65536K OK',
    'CORE PROCESSOR ARRAY .................... ONLINE',
    'SENSOR GRID ............................. ONLINE',
    'LIFE SUPPORT INTERFACE .................. NOMINAL',
    'REACTOR TELEMETRY ....................... ONLINE',
    'INTERCOM RELAY .......................... ONLINE',
    'STRUCTURAL SENSORS ...................... 2 WARNINGS',
    'NAVIGATION DATABASE ..................... LOADED',
    '',
    'LOADING A.P.O.L.L.O. KERNEL',
  ],
  greeting: 'A.P.O.L.L.O. ONLINE. WÄHLEN SIE EINE FUNKTION ODER STELLEN SIE EINE FRAGE.',
  // Kurzanzeige rechts im Hauptmenü. state: '' | 'warn' | 'crit'
  readouts: [
    { label: 'HULL INTEGRITY', value: '87%', state: 'warn' },
    { label: 'LIFE SUPPORT', value: 'NOMINAL', state: '' },
    { label: 'REACTOR OUTPUT', value: '82%', state: '' },
    { label: 'ACTIVE ALERTS', value: '02', state: 'crit' },
  ],
};

// Stationsplan: Grundriss je Ebene (js/station-level0.js) und editierbare Ebene
// (Türen, Trennlinien, Kameras, Raumnamen/-status). Bearbeitet wird im Karten-Editor (editor.html).
export const STATION = {
  levels: [{ id: 'level0', plan: LEVEL0, layer: LAYER0 }],
};

// Informationskategorien.
// keywords: starke Schlüsselwörter (Wortanfänge reichen, Umlaute egal)
// weak:     schwache Hinweise, zählen weniger
// example:  Beispielfrage für die Hilfe-Seite
export const TOPICS = [
  {
    id: 'schaden',
    title: 'SCHADENSBERICHT',
    view: 'damage',
    example: 'GIBT ES SCHÄDEN AUF DER STATION?',
    keywords: ['schaden', 'schäden', 'beschädig', 'defekt', 'kaputt', 'leck', 'hüllenbruch', 'bruch', 'riss',
      'reparatur', 'zerstör', 'damage', 'zwischenfall', 'störung', 'integrität'],
    weak: ['hülle', 'problem', 'intakt'],
    // Schadensbericht: Einleitung, Fälle, Hüllenintegrität, Empfehlung.
    // Fälle mit Raum übernehmen den Raumstatus aus dem Karten-Editor; Räume mit Status
    // erscheinen auch ohne eigenen Fall im Bericht.
    damage: {
      intro: 'STRUKTURANALYSE ABGESCHLOSSEN.',
      cases: [
        { room: '', title: 'XENOBIOLOGIE 2', status: 'damage', text: 'DRUCKVERLUST DURCH HÜLLENBRUCH. SCHOTT VERRIEGELT.' },
      ],
      hull: 87,
      hullLabel: 'HÜLLENINTEGRITÄT GESAMT',
      recommendation: '',
      none: 'KEINE SCHÄDEN GEMELDET. ALLE BEREICHE NOMINAL.',
    },
  },
  {
    id: 'lebenserhaltung',
    title: 'LEBENSERHALTUNG',
    view: 'report',
    example: 'WIE IST DIE LUFTQUALITÄT?',
    keywords: ['lebenserhaltung', 'sauerstoff', 'o2', 'co2', 'kohlendioxid', 'atemluft', 'luft', 'atmosphäre',
      'temperatur', 'luftdruck', 'druck', 'life support', 'wasser', 'filter', 'atmen'],
    weak: ['kalt', 'warm', 'klima'],
    blocks: [
      { type: 'text', text: 'LEBENSERHALTUNGSSYSTEME ARBEITEN INNERHALB DER TOLERANZEN.' },
      {
        type: 'table',
        head: ['PARAMETER', 'WERT', 'STATUS'],
        rows: [
          ['SAUERSTOFF (O2)', '20.6 %', 'NOMINAL'],
          ['KOHLENDIOXID (CO2)', '0.09 %', 'NOMINAL'],
          ['LUFTDRUCK', '101.2 KPA', 'NOMINAL'],
          ['TEMPERATUR', '18.4 °C', 'NOMINAL'],
          ['LUFTFEUCHTE', '41 %', 'NOMINAL'],
        ],
      },
      { type: 'meter', label: 'SAUERSTOFFRESERVEN', value: 72 },
      { type: 'meter', label: 'WASSERAUFBEREITUNG', value: 94 },
      { type: 'meter', label: 'LUFTFILTER', value: 58, state: 'warn' },
      { type: 'text', text: 'HINWEIS: FILTERWECHSEL IN DEN WOHNBEREICHEN (FAMILIEN/PAARE) FÄLLIG. WARNUNG WIRD IN 72 STUNDEN ESKALIERT.' },
    ],
  },
  {
    id: 'energie',
    title: 'ENERGIEVERSORGUNG',
    view: 'report',
    example: 'WIE LÄUFT DER REAKTOR?',
    keywords: ['energie', 'strom', 'reaktor', 'generator', 'batterie', 'akku', 'power', 'leistung', 'kraftwerk',
      'kühlung', 'kühlkreislauf', 'notstrom'],
    weak: ['licht', 'versorgung'],
    blocks: [
      { type: 'text', text: 'FUSIONSREAKTOR (TECHNIK & SYSTEME) IN BETRIEB. LEISTUNGSABGABE REDUZIERT.' },
      { type: 'meter', label: 'REAKTORLEISTUNG', value: 82 },
      { type: 'meter', label: 'KÜHLMITTELDURCHSATZ', value: 64, state: 'warn' },
      { type: 'meter', label: 'NOTSTROMBATTERIEN', value: 100 },
      {
        type: 'table',
        head: ['VERBRAUCHER', 'LAST', 'STATUS'],
        rows: [
          ['LEBENSERHALTUNG', '31 %', 'NOMINAL'],
          ['XENOBIOLOGIE', '22 %', 'NOMINAL'],
          ['KOMMUNIKATION', '9 %', 'NOMINAL'],
          ['XENOBIOLOGIE 2', '0 %', 'OFFLINE'],
        ],
      },
      { type: 'alert', text: 'WARNUNG: KÜHLKREISLAUF 2 MELDET DRUCKABFALL. URSACHE UNBEKANNT.' },
    ],
  },
  {
    id: 'status',
    title: 'STATIONSSTATUS',
    view: 'report',
    example: 'WIE IST DIE LAGE?',
    keywords: ['status', 'lagebericht', 'übersicht', 'zustand', 'systemstatus', 'systeme', 'überblick'],
    weak: ['bericht', 'lage', 'situation', 'ausfall', 'alles'],
    blocks: [
      { type: 'text', text: `${CONFIG.station} // ${CONFIG.moon} // BETREIBER: ${CONFIG.company}` },
      {
        type: 'table',
        head: ['SYSTEM', 'STATUS'],
        rows: [
          ['STRUKTUR', 'WARNUNG'],
          ['LEBENSERHALTUNG', 'NOMINAL'],
          ['ENERGIE', 'WARNUNG'],
          ['KOMMUNIKATION', 'NOMINAL'],
          ['SENSORNETZ', 'NOMINAL'],
          ['XENOBIOLOGIE 2', 'OFFLINE'],
        ],
      },
      { type: 'text', text: 'ANWESENDES PERSONAL: 6. NÄCHSTER VERSORGUNGSFLUG: 41 TAGE.' },
    ],
  },
  {
    id: 'personal',
    title: 'PERSONALREGISTER',
    view: 'report',
    example: 'WER IST AUF DER STATION?',
    keywords: ['personal', 'besatzung', 'crew', 'bewohner', 'mitarbeiter', 'personen', 'leute', 'team',
      'wer ist', 'wer arbeitet', 'anwesend', 'manifest'],
    weak: ['wer', 'name', 'namen', 'jemand'],
    blocks: [
      { type: 'text', text: 'REGISTRIERTES PERSONAL AN BORD:' },
      {
        type: 'table',
        head: ['NAME', 'FUNKTION', 'LETZTER STANDORT'],
        rows: [
          ['MARCUS HOLT', 'STATIONSLEITER', 'ADMINISTRATION'],
          ['DR. ELENA REYES', 'WISSENSCHAFTLERIN', 'XENOBIOLOGIE'],
          ['JONAH PIKE', 'TECHNIKER', 'TECHNIK & SYSTEME'],
          ['DR. AMARA OKAFOR', 'ÄRZTIN', 'KRANKENSTATION'],
          ['VIKTOR SAND', 'SICHERHEIT', 'MARSHAL'],
          ['LENA KOWALSKI', 'LOGISTIK', 'NICHT ERREICHBAR'],
        ],
      },
      { type: 'text', text: 'KONTAKTAUFNAHME ÜBER INTERKOM: MENÜPUNKT [H].' },
    ],
  },
  {
    id: 'apollo',
    title: 'SYSTEMIDENTIFIKATION',
    view: 'report',
    example: 'WER BIST DU?',
    keywords: ['apollo', 'a p o l l o', 'wer bist', 'wer sind sie', 'identität', 'computer', 'ki', 'künstliche'],
    weak: [],
    blocks: [
      { type: 'text', text: `ICH BIN ${CONFIG.computer}: ${CONFIG.computerLong}.` },
      { type: 'text', text: `MODELL ${CONFIG.model}, IN BETRIEB GENOMMEN VON ${CONFIG.company} FÜR ${CONFIG.station}.` },
      { type: 'text', text: 'MEINE AUFGABE IST DIE ÜBERWACHUNG ALLER STATIONSSYSTEME UND DIE UNTERSTÜTZUNG DES PERSONALS.' },
    ],
  },
  {
    id: 'stationsplan',
    title: 'STATIONSPLAN',
    view: 'map',
    level: 'station',
    example: 'ZEIG MIR DEN LAGEPLAN.',
    keywords: ['stationsplan', 'lageplan', 'grundriss', 'plan', 'deck', 'räume', 'modul', 'wo ist', 'wo befindet',
      'wie komme', 'layout', 'stationskarte', 'map', 'oxi', 'neroponti', 'on twex'],
    weak: ['karte', 'station', 'weg', 'gang', 'korridor', 'sektor'],
  },
  {
    id: 'mond',
    title: 'MONDKARTE',
    view: 'map',
    level: 'moon',
    example: 'WAS IST AUF DER MONDOBERFLÄCHE?',
    keywords: ['mond', 'oberfläche', 'gelände', 'terrain', 'krater', 'topographie', 'umgebung', 'draußen', 'außen',
      CONFIG.moon, 'twex'],
    weak: ['boden', 'landschaft'],
  },
  {
    id: 'sonnensystem',
    title: 'SONNENSYSTEM',
    view: 'map',
    level: 'system',
    example: 'WELCHE PLANETEN GIBT ES HIER?',
    keywords: ['sonnensystem', 'systemkarte', 'planet', 'planeten', 'umlaufbahn', 'orbit', 'sonne', 'gasriese', 'carpenter', CONFIG.star],
    weak: ['system'],
  },
  {
    id: 'sterne',
    title: 'STERNENKARTE',
    view: 'map',
    level: 'stars',
    example: 'WO BEFINDEN WIR UNS?',
    keywords: ['sternenkarte', 'stern', 'galaxie', 'galaktisch', 'navigation', 'koordinaten', 'position',
      'wo sind wir', 'wo befinden wir', 'entfernung', 'erde', 'heimat', 'kurs', 'borodino', 'parsec', 'sol'],
    weak: ['weltraum', 'all', 'universum'],
  },
  {
    id: 'interkom',
    title: 'INTERKOM',
    view: 'interkom',
    example: 'ICH MÖCHTE JEMANDEN ANRUFEN.',
    keywords: ['interkom', 'intercom', 'anruf', 'rufen', 'kontakt', 'nachricht', 'funk', 'sprechen', 'verbindung',
      'erreichen', 'melden', 'schreiben', 'chat'],
    weak: ['reden', 'telefon'],
  },
  {
    id: 'hilfe',
    title: 'HILFE',
    view: 'help',
    keywords: ['hilfe', 'help', 'befehle', 'kommandos', 'anleitung', 'was kannst', 'optionen', 'funktionen'],
    weak: [],
  },
];

// Hauptmenü: Taste → Kategorie
export const MENU = [
  { key: 'A', label: 'SCHADENSBERICHT', topic: 'schaden' },
  { key: 'B', label: 'LEBENSERHALTUNG', topic: 'lebenserhaltung' },
  { key: 'C', label: 'ENERGIEVERSORGUNG', topic: 'energie' },
  { key: 'D', label: 'STATIONSPLAN', topic: 'stationsplan' },
  { key: 'E', label: 'MONDKARTE TWEX9', topic: 'mond' },
  { key: 'F', label: 'SYSTEMKARTE DS282', topic: 'sonnensystem' },
  { key: 'G', label: 'STERNENKARTE', topic: 'sterne' },
  { key: 'H', label: 'INTERKOM', topic: 'interkom' },
  { key: 'I', label: 'HILFE', topic: 'hilfe' },
];

// Stationsbewohner für das Interkom. image: Pfad zu einem Bild, z. B. 'img/reyes.jpg', oder null.
export const PERSONNEL = [
  { name: 'MARCUS HOLT', role: 'STATIONSLEITER', location: 'ADMINISTRATION', available: true, image: null },
  { name: 'DR. ELENA REYES', role: 'LEITENDE WISSENSCHAFTLERIN', location: 'XENOBIOLOGIE', available: true, image: null },
  { name: 'JONAH PIKE', role: 'TECHNIKER', location: 'TECHNIK & SYSTEME', available: true, image: null },
  { name: 'DR. AMARA OKAFOR', role: 'STATIONSÄRZTIN', location: 'KRANKENSTATION', available: true, image: null },
  { name: 'VIKTOR SAND', role: 'SICHERHEITSCHEF', location: 'MARSHAL', available: true, image: null },
  { name: 'LENA KOWALSKI', role: 'LOGISTIK', location: 'UNBEKANNT', available: false, image: null },
];

// Nur für den Prototyp: simulierte Antworten, bis die Spielleiter-Konsole angebunden ist.
export const DEMO_REPLIES = [
  'HIER SPRICHT {name}. WAS GIBT ES?',
  'VERSTANDEN. ICH KÜMMERE MICH DARUM.',
  'DAS KANN ICH ÜBER DIE LEITUNG NICHT SAGEN. KOMMEN SIE VORBEI.',
  'MOMENT … ICH MELDE MICH GLEICH WIEDER.',
];
