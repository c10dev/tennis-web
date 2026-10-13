// Icons from Lucide v0.468.0 (ISC, see LICENSE-lucide.txt): zap, shield, rotate-ccw for the cards; eye (the tell),
// trophy (the ladder), chevrons-up (a rise), volume-2 / volume-x (the sound toggle), and check, x, equal, arrow-right,
// chevron-up / chevron-down for the marks the fonts lack (TD-042), and skip-back, play, pause, skip-forward for the
// replay transport. Copied path data, no package; eye's circle and
// equal's lines are written as paths.
import type { Card } from '@tennis/engine';

const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  attack: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  defend: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  counter: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  eye: ['M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0', 'M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0'],
  trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  'chevrons-up': ['m17 11-5-5-5 5', 'm17 18-5-5-5 5'],
  check: ['M20 6 9 17l-5-5'],
  'skip-back': ['M19 20 9 12l10-8z', 'M5 19V5'],
  'skip-forward': ['M5 4l10 8-10 8z', 'M19 5v14'],
  play: ['M6 3 20 12 6 21z'],
  pause: ['M14 4h4v16h-4z', 'M6 4h4v16H6z'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  equal: ['M5 9h14', 'M5 15h14'],
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  'chevron-up': ['m18 15-6-6-6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'volume-2': ['M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z',
    'M16 9a5 5 0 0 1 0 6', 'M19.364 18.364a9 9 0 0 0 0-12.728'],
  'volume-x': ['M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z',
    'm22 9-6 6', 'm16 9 6 6'],
} satisfies Record<Card | string, string[]>;
export type IconName = keyof typeof PATHS;

/** A decorative icon (aria-hidden: a word always sits next to it). */
export function icon(name: IconName, size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({ class: `icon icon-${name}`, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) {
    svg.setAttribute(k, String(v));
  }
  for (const d of PATHS[name]) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/** The card's icon (the card's name is always written next to it). */
export const cardIcon = (card: Card, size = 20): SVGSVGElement => icon(card, size);

/** A mark the fonts lack (✓ ✗ = → ▲ ▼, TD-042): the icon at the text's size, the character kept for screen readers and
 *  in the text content. */
export function glyph(name: IconName, text: string, cls = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `glyph${cls ? ` ${cls}` : ''}`;
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  span.append(icon(name), sr);
  return span;
}
