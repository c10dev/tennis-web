// The reading tip at a player's first decision point (TD-027): shown until dismissed or a card is picked, then never
// again on this browser (localStorage).
import { readingHint } from '@tennis/game';
import { h } from '../lib/h.ts';

const KEY = 'tennis-hints';

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'seen';
  } catch {
    return false;
  }
}

/** Remembers that the tip has done its job. */
export function retireHint(): void {
  try {
    localStorage.setItem(KEY, 'seen');
  } catch {
    // Private windows may refuse storage; the tip then shows once per page.
  }
}

/** The tip, or null once seen; `dismissed` runs after Got it removes it. */
export function readingTip(dismissed: () => void): HTMLElement | null {
  if (seen()) return null;
  const tip: HTMLElement = h('p', { class: 'hint paper', id: 'hint', role: 'note' },
    h('span', null, readingHint()),
    h('button', { type: 'button', class: 'hint-dismiss', id: 'hint-dismiss', onclick: () => {
      retireHint();
      tip.remove();
      dismissed();
    } }, 'Got it'));
  return tip;
}
