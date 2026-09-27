// Stilisiertes Weyland-Yutani-Emblem als SVG.
export function wyLogo(cls = '') {
  return `<svg class="wy ${cls}" viewBox="0 0 120 40" role="img" aria-label="Weyland-Yutani">
    <path d="M0 1 H22 L38 27 L50 11 H70 L82 27 L98 1 H120 L92 39 H74 L60 19 L46 39 H28 Z"/>
    <path d="M50 1 H70 L60 8 Z"/>
  </svg>`;
}
