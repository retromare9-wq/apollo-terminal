// Alle Inhalte des Terminals. Texte, Namen und Werte hier ändern –
// der restliche Code muss dafür nicht angefasst werden.
// Wörter wie KRITISCH, WARNUNG oder OFFLINE werden in Berichten automatisch eingefärbt.

export const CONFIG = {
  computer: 'A.P.O.L.L.O.',
  computerLong: 'ADVANCED PLANETARY OPERATIONS, LOGISTICS & LIFE-SUPPORT OVERSIGHT',
  model: 'APOLLO 3000',
  company: 'WEYLAND-YUTANI CORP.',
  year: 2183,
  station: 'TANTALUS STATION',
  stationCode: 'TS-417',
  moon: 'LV-417',
  planet: 'KG-229 III',
  star: 'KG-229',
  system: 'KG-229 SYSTEM',
  systemCode: '42 053 740',
  terminalId: 'T-01',
  greeting: 'A.P.O.L.L.O. ONLINE. WÄHLEN SIE EINE FUNKTION ODER STELLEN SIE EINE FRAGE.',
  // Kurzanzeige rechts im Hauptmenü. state: '' | 'warn' | 'crit'
  readouts: [
    { label: 'HULL INTEGRITY', value: '87%', state: 'warn' },
    { label: 'LIFE SUPPORT', value: 'NOMINAL', state: '' },
    { label: 'REACTOR OUTPUT', value: '82%', state: '' },
    { label: 'ACTIVE ALERTS', value: '02', state: 'crit' },
  ],
};

// Module der Station für den Stationsplan (Koordinaten im Kartenraster 1000 × 446).
// status: 'ok' | 'warn' | 'damage'   terminal: true markiert den Standort des Terminals.
export const STATION = {
  modules: [
    { id: 'hangar', name: 'HANGAR', code: 'H-01', x: 50, y: 170, w: 150, h: 110, status: 'ok' },
    { id: 'wohn', name: 'WOHNMODUL', code: 'W-02', x: 260, y: 110, w: 150, h: 70, status: 'ok' },
    { id: 'kantine', name: 'KANTINE', code: 'W-03', x: 260, y: 260, w: 150, h: 60, status: 'ok' },
    { id: 'kommando', name: 'KOMMANDO', code: 'C-01', x: 460, y: 110, w: 150, h: 70, status: 'ok', terminal: true },
    { id: 'lager', name: 'LAGER C', code: 'L-03', x: 460, y: 260, w: 150, h: 60, status: 'damage' },
    { id: 'labor', name: 'LABOR A', code: 'R-01', x: 660, y: 110, w: 150, h: 70, status: 'ok' },
    { id: 'medizin', name: 'MEDIZIN', code: 'M-01', x: 660, y: 260, w: 150, h: 60, status: 'ok' },
    { id: 'reaktor', name: 'REAKTOR', code: 'E-01', x: 855, y: 170, w: 110, h: 110, status: 'warn' },
  ],
  corridors: [
    ['hangar', 'wohn'], ['hangar', 'kantine'], ['wohn', 'kommando'], ['kommando', 'labor'],
    ['labor', 'reaktor'], ['medizin', 'reaktor'], ['wohn', 'kantine'], ['kommando', 'lager'],
    ['labor', 'medizin'], ['kantine', 'lager'], ['lager', 'medizin'],
  ],
};

// Informationskategorien.
// keywords: starke Schlüsselwörter (Wortanfänge reichen, Umlaute egal)
// weak:     schwache Hinweise, zählen weniger
// example:  Beispielfrage für die Hilfe-Seite
export const TOPICS = [
  {
    id: 'schaden',
    title: 'SCHADENSBERICHT',
    view: 'report',
    example: 'GIBT ES SCHÄDEN AUF DER STATION?',
    keywords: ['schaden', 'schäden', 'beschädig', 'defekt', 'kaputt', 'leck', 'hüllenbruch', 'bruch', 'riss',
      'reparatur', 'zerstör', 'damage', 'zwischenfall', 'störung', 'integrität'],
    weak: ['hülle', 'problem', 'intakt'],
    blocks: [
      { type: 'text', text: 'STRUKTURANALYSE ABGESCHLOSSEN. 2 BEREICHE MIT AUFFÄLLIGKEITEN ERKANNT.' },
      { type: 'alert', text: 'LAGER C: DRUCKVERLUST DURCH HÜLLENBRUCH IN SEKTOR 4. SCHOTT VERRIEGELT.' },
      {
        type: 'table',
        head: ['BEREICH', 'STATUS', 'INTEGRITÄT'],
        rows: [
          ['KOMMANDO', 'NOMINAL', '100%'],
          ['WOHNMODUL', 'NOMINAL', '98%'],
          ['LABOR A', 'NOMINAL', '96%'],
          ['LAGER C', 'KRITISCH', '41%'],
          ['REAKTOR', 'WARNUNG', '78%'],
          ['HANGAR', 'NOMINAL', '92%'],
        ],
      },
      { type: 'meter', label: 'HÜLLENINTEGRITÄT GESAMT', value: 87, state: 'warn' },
      { type: 'text', text: 'EMPFEHLUNG: WARTUNGSTEAM ZU LAGER C ENTSENDEN. KÜHLKREISLAUF DES REAKTORS ÜBERPRÜFEN.' },
    ],
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
      { type: 'text', text: 'HINWEIS: FILTERWECHSEL IN WOHNMODUL W-02 FÄLLIG. WARNUNG WIRD IN 72 STUNDEN ESKALIERT.' },
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
      { type: 'text', text: 'FUSIONSREAKTOR E-01 IN BETRIEB. LEISTUNGSABGABE REDUZIERT.' },
      { type: 'meter', label: 'REAKTORLEISTUNG', value: 82 },
      { type: 'meter', label: 'KÜHLMITTELDURCHSATZ', value: 64, state: 'warn' },
      { type: 'meter', label: 'NOTSTROMBATTERIEN', value: 100 },
      {
        type: 'table',
        head: ['VERBRAUCHER', 'LAST', 'STATUS'],
        rows: [
          ['LEBENSERHALTUNG', '31 %', 'NOMINAL'],
          ['LABOR A', '22 %', 'NOMINAL'],
          ['KOMMUNIKATION', '9 %', 'NOMINAL'],
          ['LAGER C', '0 %', 'OFFLINE'],
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
          ['LAGER C', 'OFFLINE'],
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
          ['MARCUS HOLT', 'STATIONSLEITER', 'KOMMANDO'],
          ['DR. ELENA REYES', 'WISSENSCHAFTLERIN', 'LABOR A'],
          ['JONAH PIKE', 'TECHNIKER', 'REAKTOR'],
          ['DR. AMARA OKAFOR', 'ÄRZTIN', 'MEDIZIN'],
          ['VIKTOR SAND', 'SICHERHEIT', 'HANGAR'],
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
      'wie komme', 'layout', 'stationskarte', 'map'],
    weak: ['karte', 'station', 'weg', 'gang', 'korridor', 'sektor'],
  },
  {
    id: 'mond',
    title: 'MONDKARTE',
    view: 'map',
    level: 'moon',
    example: 'WAS IST AUF DER MONDOBERFLÄCHE?',
    keywords: ['mond', 'oberfläche', 'gelände', 'terrain', 'krater', 'topographie', 'umgebung', 'draußen', 'außen',
      CONFIG.moon],
    weak: ['boden', 'landschaft'],
  },
  {
    id: 'sonnensystem',
    title: 'SONNENSYSTEM',
    view: 'map',
    level: 'system',
    example: 'WELCHE PLANETEN GIBT ES HIER?',
    keywords: ['sonnensystem', 'planet', 'planeten', 'umlaufbahn', 'orbit', 'sonne', CONFIG.star],
    weak: ['system'],
  },
  {
    id: 'sterne',
    title: 'STERNENKARTE',
    view: 'map',
    level: 'stars',
    example: 'WO BEFINDEN WIR UNS?',
    keywords: ['sternenkarte', 'stern', 'galaxie', 'galaktisch', 'navigation', 'koordinaten', 'position',
      'wo sind wir', 'wo befinden wir', 'entfernung', 'erde', 'heimat', 'kurs'],
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
  { key: 'E', label: 'MONDKARTE', topic: 'mond' },
  { key: 'F', label: 'SONNENSYSTEM', topic: 'sonnensystem' },
  { key: 'G', label: 'STERNENKARTE', topic: 'sterne' },
  { key: 'H', label: 'INTERKOM', topic: 'interkom' },
  { key: 'I', label: 'HILFE', topic: 'hilfe' },
];

// Stationsbewohner für das Interkom. image: Pfad zu einem Bild, z. B. 'img/reyes.jpg', oder null.
export const PERSONNEL = [
  { name: 'MARCUS HOLT', role: 'STATIONSLEITER', location: 'KOMMANDO', available: true, image: null },
  { name: 'DR. ELENA REYES', role: 'LEITENDE WISSENSCHAFTLERIN', location: 'LABOR A', available: true, image: null },
  { name: 'JONAH PIKE', role: 'TECHNIKER', location: 'REAKTOR', available: true, image: null },
  { name: 'DR. AMARA OKAFOR', role: 'STATIONSÄRZTIN', location: 'MEDIZIN', available: true, image: null },
  { name: 'VIKTOR SAND', role: 'SICHERHEITSCHEF', location: 'HANGAR', available: true, image: null },
  { name: 'LENA KOWALSKI', role: 'LOGISTIK', location: 'UNBEKANNT', available: false, image: null },
];

// Nur für den Prototyp: simulierte Antworten, bis die Spielleiter-Konsole angebunden ist.
export const DEMO_REPLIES = [
  'HIER SPRICHT {name}. WAS GIBT ES?',
  'VERSTANDEN. ICH KÜMMERE MICH DARUM.',
  'DAS KANN ICH ÜBER DIE LEITUNG NICHT SAGEN. KOMMEN SIE VORBEI.',
  'MOMENT … ICH MELDE MICH GLEICH WIEDER.',
];
