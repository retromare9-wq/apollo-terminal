// Semiotic Standard – Piktogramme als SVG (100 × 100), frei nachgezeichnet nach der Vorlage.

const R = '#e8202a';   // Signalrot
const L = '#e6e8ee';   // Hell
const G = '#8a8580';   // Grau
const K = '#141414';   // Schwarz
const B = '#2e3a9a';   // Blau
const O = '#e8761c';   // Orange
const N = '#1e5a2a';   // Dunkelgrün

const frame = (inner = L) => `<rect x="4" y="4" width="92" height="92" rx="15" fill="${R}"/><rect x="15" y="15" width="70" height="70" rx="4" fill="${inner}"/>`;
const gaps = (h = true, v = true) => `${h ? `<rect x="4" y="45" width="11" height="10" fill="${L}"/><rect x="85" y="45" width="11" height="10" fill="${L}"/>` : ''}${v ? `<rect x="45" y="4" width="10" height="11" fill="${L}"/><rect x="45" y="85" width="10" height="11" fill="${L}"/>` : ''}`;

export const SEMIOTIC = [
  { id: 1, name: 'PRESSURISED AREA', de: 'Druckbereich', svg: frame() },
  { id: 2, name: 'PRESSURISED WITH ARTIFICIAL GRAVITY', de: 'Druckbereich mit künstlicher Schwerkraft',
    svg: `${frame()}<circle cx="50" cy="31" r="7" fill="${R}"/><path d="M42 44 H56 V74 H46 V54 H42 Z" fill="${R}"/>` },
  { id: 3, name: 'ARTIFICIAL GRAVITY ABSENT', de: 'Keine künstliche Schwerkraft',
    svg: `${frame()}<path d="M30 26 L50 44 L70 26" stroke="${R}" stroke-width="8" fill="none"/><rect x="46" y="42" width="8" height="14" fill="${R}"/><rect x="30" y="56" width="40" height="7" fill="${R}"/><circle cx="50" cy="73" r="6" fill="${R}"/>` },
  { id: 4, name: 'CRYOGENIC VAULT', de: 'Kryo-Kammer',
    svg: `${frame()}<path d="M30 24 H70 L50 56 Z" fill="${B}"/><rect x="26" y="64" width="34" height="8" fill="${R}"/><circle cx="68" cy="68" r="6" fill="${R}"/>` },
  { id: 5, name: 'AIRLOCK', de: 'Luftschleuse',
    svg: `${frame()}<path d="M18 18 H82 V82 Z" fill="${K}"/>${gaps(true, false)}` },
  { id: 6, name: 'BULKHEAD DOOR', de: 'Schott',
    svg: `${frame()}<rect x="60" y="8" width="32" height="84" rx="8" fill="${K}"/><rect x="42" y="22" width="8" height="56" fill="${R}"/>` },
  { id: 7, name: 'NO PRESSURISED AREA BEYOND', de: 'Kein Druckbereich dahinter',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${R}"/><rect x="15" y="4" width="70" height="78" rx="4" fill="${K}"/><rect x="4" y="4" width="92" height="12" rx="6" fill="${K}"/>` },
  { id: 8, name: 'PRESSURE SUIT LOCKER', de: 'Druckanzug-Spind',
    svg: `${frame(G)}<circle cx="50" cy="33" r="8" fill="${L}"/><rect x="30" y="43" width="40" height="9" fill="${L}"/><rect x="42" y="43" width="16" height="36" fill="${L}"/>` },
  { id: 9, name: 'PHOTONIC SYSTEM (FIBRE OPTICS)', de: 'Photonik (Glasfaser)',
    svg: `${frame(G)}<path d="M72 28 H30 V72 M30 50 H70 V68 H44 V58" stroke="${L}" stroke-width="7" fill="none"/>${gaps(true, false)}` },
  { id: 10, name: 'LASER', de: 'Laser',
    svg: `${frame(G)}<path d="M50 24 L76 50 L50 76 L24 50 Z" fill="${L}"/>${gaps()}` },
  { id: 11, name: 'ASTRONIC SYSTEM (ELECTRONICS)', de: 'Astronik (Elektronik)',
    svg: `${frame()}<rect x="15" y="52" width="70" height="33" fill="${G}"/><rect x="46" y="22" width="8" height="24" fill="${G}"/><rect x="38" y="30" width="24" height="8" fill="${G}"/><rect x="38" y="66" width="24" height="6" fill="${L}"/>${gaps(true, false)}` },
  { id: 12, name: 'HAZARD / WARNING', de: 'Gefahr / Warnung',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${R}"/><rect x="38" y="4" width="24" height="20" fill="${L}"/><rect x="38" y="76" width="24" height="20" fill="${L}"/><rect x="4" y="38" width="20" height="24" fill="${L}"/><rect x="76" y="38" width="20" height="24" fill="${L}"/>` },
  { id: 13, name: 'ARTIFICIAL GRAVITY AREA, SUIT REQUIRED', de: 'Schwerkraftbereich, Anzug nötig',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${R}"/><rect x="4" y="4" width="92" height="80" rx="15" fill="${K}"/><rect x="38" y="22" width="24" height="18" rx="6" fill="${L}"/><rect x="34" y="40" width="32" height="12" fill="${L}"/><rect x="40" y="52" width="20" height="30" fill="${L}"/><circle cx="50" cy="31" r="6" fill="${R}"/>` },
  { id: 14, name: 'NO PRESSURE / GRAVITY, SUIT REQUIRED', de: 'Kein Druck / keine Schwerkraft, Anzug nötig',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${K}"/><path d="M30 26 L50 46 L70 26" stroke="${L}" stroke-width="10" fill="none"/><rect x="44" y="44" width="12" height="16" fill="${L}"/><circle cx="50" cy="66" r="12" fill="${L}"/><circle cx="50" cy="68" r="7" fill="${R}"/>` },
  { id: 15, name: 'EXHAUST', de: 'Abgas',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${L}"/><path d="M14 10 V50 L6 90 H22 L28 50 V10 Z M34 10 V54 L28 90 H42 L44 54 V10 Z M56 10 V54 L58 90 H72 L66 54 V10 Z M86 10 V50 L94 90 H78 L72 50 V10 Z" fill="${O}"/>` },
  { id: 16, name: 'AREA SHIELDED FROM RADIATION', de: 'Strahlungsgeschützter Bereich',
    svg: `<rect x="4" y="4" width="92" height="92" rx="15" fill="${R}"/><rect x="26" y="26" width="48" height="48" rx="10" fill="${L}"/><circle cx="50" cy="38" r="6" fill="${R}"/><path d="M43 48 H56 V68 H47 V56 H43 Z" fill="${R}"/>` },
  { id: 17, name: 'RADIATION HAZARD', de: 'Strahlungsgefahr',
    svg: `${frame(O)}<rect x="24" y="60" width="32" height="10" fill="${K}"/><circle cx="66" cy="65" r="8" fill="${K}"/>` },
  { id: 18, name: 'HIGH RADIOACTIVITY', de: 'Hohe Radioaktivität',
    svg: `${frame(O)}<path d="M15 15 H85 L50 50 Z M15 85 H85 L50 50 Z" fill="${K}"/><path d="M4 4 L96 96 M96 4 L4 96" stroke="${L}" stroke-width="5"/>` },
  { id: 19, name: 'REFRIGERATOR', de: 'Kühlraum',
    svg: `${frame()}<rect x="24" y="24" width="52" height="52" fill="${B}"/><rect x="33" y="33" width="34" height="34" fill="${L}"/>` },
  { id: 20, name: 'DIRECTION', de: 'Richtung',
    svg: `${frame()}<path d="M24 62 L50 36 L76 62" stroke="${R}" stroke-width="12" fill="none"/>` },
  { id: 21, name: 'LIFE SUPPORT SYSTEM', de: 'Lebenserhaltung',
    svg: `${frame(G)}<rect x="34" y="38" width="32" height="24" fill="${L}"/><path d="M24 26 V40 M24 60 V74 M76 26 V40 M76 60 V74 M24 26 H40 M24 74 H40 M76 26 H60 M76 74 H60" stroke="${L}" stroke-width="6" fill="none"/>` },
  { id: 22, name: 'GALLEY', de: 'Kombüse',
    svg: `${frame()}<rect x="20" y="20" width="60" height="60" fill="${N}"/><circle cx="50" cy="50" r="22" fill="${L}"/>` },
  { id: 23, name: 'COFFEE', de: 'Kaffee',
    svg: `${frame()}<rect x="20" y="20" width="60" height="60" fill="${N}"/><rect x="28" y="40" width="44" height="20" rx="3" fill="${L}"/><rect x="60" y="44" width="7" height="12" fill="${N}"/>` },
  { id: 24, name: 'BRIDGE', de: 'Brücke',
    svg: `${frame()}<rect x="20" y="20" width="60" height="60" fill="${G}"/><path d="M50 28 L74 72 H26 Z" fill="${L}"/>` },
  { id: 25, name: 'AUTODOC', de: 'Autodoc',
    svg: `${frame()}<rect x="26" y="26" width="18" height="18" fill="${N}"/><rect x="56" y="26" width="18" height="18" fill="${N}"/><rect x="26" y="56" width="18" height="18" fill="${N}"/><rect x="56" y="56" width="18" height="18" fill="${N}"/>` },
  { id: 26, name: 'COMPUTER TERMINAL', de: 'Computerterminal',
    svg: `${frame()}<rect x="22" y="22" width="56" height="56" fill="${G}"/><rect x="28" y="28" width="44" height="18" fill="${L}"/>${[0, 1, 2, 3].map((i) => `<rect x="${29 + i * 11}" y="52" width="8" height="8" fill="${L}"/><rect x="${29 + i * 11}" y="63" width="8" height="8" fill="${L}"/>`).join('')}` },
  { id: 27, name: 'MAINTENANCE', de: 'Wartung',
    svg: `${frame()}<path d="M22 22 H40 V52 L32 62 V78 H22 Z M78 22 H60 V52 L68 62 V78 H78 Z M44 52 H56 V78 H44 Z" fill="${G}"/>` },
  { id: 28, name: 'LADDER WAY', de: 'Leitergang',
    svg: `${frame()}<rect x="22" y="20" width="8" height="60" fill="${G}"/><rect x="70" y="20" width="8" height="60" fill="${G}"/><rect x="36" y="24" width="28" height="10" fill="${G}"/><rect x="36" y="40" width="28" height="20" fill="${G}"/><rect x="36" y="66" width="28" height="10" fill="${G}"/>` },
  { id: 29, name: 'INTERCOM', de: 'Interkom',
    svg: `${frame()}<path d="M18 26 H40 L52 40 L40 56 H18 Z" fill="${G}"/><path d="M82 44 H66 L56 58 L66 76 H82 Z" fill="${G}"/>` },
  { id: 30, name: 'STORAGE (NON ORGANIC)', de: 'Lager (anorganisch)',
    svg: `${frame()}<rect x="22" y="22" width="56" height="56" fill="${G}"/><rect x="34" y="34" width="32" height="32" fill="${L}"/><rect x="40" y="40" width="20" height="20" fill="${G}"/>` },
  { id: 31, name: 'STORAGE (ORGANIC)', de: 'Lager (organisch)',
    svg: `${frame()}<rect x="22" y="22" width="56" height="56" fill="${G}"/><rect x="34" y="34" width="32" height="32" fill="${N}"/>` },
];

export const semioticById = (id) => SEMIOTIC.find((s) => s.id === Number(id));

// Als eigenständiges SVG (für HTML)
export function semioticSvg(id, size = 40) {
  const s = semioticById(id);
  if (!s) return '';
  return `<svg class="semi" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${s.name}">${s.svg}</svg>`;
}
