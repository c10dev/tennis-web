// Draws an OverlayModel as DOM (GDD §8.2). Text from replay files only ever goes through textContent.
import type { MatchStats } from '@tennis/engine';
import type { OverlayModel } from './overlays.ts';

export interface OverlayView {
  readonly element: HTMLElement;
  update(model: OverlayModel, names: [string, string]): void;
}

const el = (tag: string, className: string, text = '') => {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
};

const STAT_ROWS: [string, (s: MatchStats, i: 0 | 1) => string][] = [
  ['1st serve in', (s, i) => `${Math.round(s.firstServePct[i] * 100)}%`],
  ['Aces', (s, i) => String(s.aces[i])],
  ['Double faults', (s, i) => String(s.doubleFaults[i])],
  ['Winners', (s, i) => String(s.winners[i])],
  ['Unforced errors', (s, i) => String(s.unforcedErrors[i])],
  ['Break points won', (s, i) => s.breakPoints[i]],
];

export function createOverlays(): OverlayView {
  const element = el('div', 'overlays');
  const slots = {
    replay: el('div', 'ov-replay'),
    serve: el('div', 'ov-serve'),
    rally: el('div', 'ov-rally'),
    lower: el('div', 'ov-lower'),
    intro: el('div', 'ov-intro'),
    hawkeye: el('div', 'ov-hawkeye'),
    stats: el('div', 'ov-stats'),
  };
  element.append(...Object.values(slots));
  const last: Record<string, string> = {};
  /** Redraw a slot only when its part of the model changed. */
  const slot = (name: keyof typeof slots, value: unknown, draw: (root: HTMLElement) => void) => {
    const key = JSON.stringify(value);
    if (last[name] === key) return;
    last[name] = key;
    const root = slots[name];
    root.replaceChildren();
    root.hidden = value === null || value === false;
    if (!root.hidden) draw(root);
  };
  return {
    element,
    update(m, names) {
      slot('replay', m.replay, (r) => r.append('REPLAY'));
      slot('serve', m.serveSpeed, (r) => r.append(el('span', 'value', `${m.serveSpeed!.kmh} km/h`), el('span', 'label', m.serveSpeed!.label)));
      slot('rally', m.rally, (r) => r.append(el('span', 'label', 'Rally'), el('span', 'value', String(m.rally))));
      slot('lower', m.lowerThird, (r) => r.append(el('span', 'title', m.lowerThird!.title), el('span', 'detail', m.lowerThird!.detail ?? '')));
      slot('intro', m.intro, (r) => r.append(...m.intro!.map((p) => {
        const card = el('div', 'player');
        card.append(el('span', 'name', p.name), el('span', 'style', p.style));
        return card;
      })));
      slot('hawkeye', m.hawkeye, (r) => r.append(el('span', `call ${m.hawkeye!.call.toLowerCase()}`, m.hawkeye!.call),
        el('span', 'margin', `${m.hawkeye!.cm.toFixed(1)} cm`)));
      slot('stats', m.stats, (r) => {
        const table = document.createElement('table');
        const head = document.createElement('tr');
        head.append(el('th', 'side', names[0]), el('th', 'title', m.stats!.title), el('th', 'side', names[1]));
        table.append(head);
        for (const [label, value] of STAT_ROWS) {
          const row = document.createElement('tr');
          row.append(el('td', 'side', value(m.stats!.stats, 0)), el('td', 'label', label), el('td', 'side', value(m.stats!.stats, 1)));
          table.append(row);
        }
        r.append(table);
      });
    },
  };
}
