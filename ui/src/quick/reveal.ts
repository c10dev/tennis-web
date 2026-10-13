// The simultaneous reveal (ADR-021, after Marvel Snap): both cards lie face down for a beat, flip at the same instant
// (one class on the parent, so neither side shows first), and the verdict pops a little later with a small clash: one
// white frame and a 6 px kick on the winning card. Timing comes from QUICK_PACE.reveal, which the pace model sums.
import type { Card } from '@tennis/engine';
import { CARD_LABEL, QUICK_PACE, type revealView } from '@tennis/game';
import { h } from '../lib/h.ts';
import { cardIcon } from '../lib/icons.ts';
import { prefersReducedMotion } from '../lib/motion.ts';

const P = QUICK_PACE.reveal;
const sleep = (sec: number) => new Promise((r) => setTimeout(r, sec * 1000));
type Reveal = ReturnType<typeof revealView>;

const VERDICT: Record<Reveal['matchup'], string> = { won: '✓ You read it!', lost: '✗ They read you', even: '= Same card' };

/** A card that can flip: a plain back, and the front chip (icon, name). */
const flipCard = (side: 'yours' | 'theirs', card: Card, text: string, winner: boolean) =>
  h('span', { class: `flip ${side}${winner ? ' is-winner' : ''}` },
    h('span', { class: 'face back', 'aria-hidden': 'true' }),
    h('span', { class: `face front chip ${card}` }, cardIcon(card, 16), text));

/** The reveal, face down; every final text is in the page from the start. */
export function revealElement(r: Reveal, opponent: string): HTMLElement {
  return h('div', {
    class: `reveal ${r.matchup} is-facedown`, id: 'reveal',
    style: `--flip-dur:${P.flipSec * 1000}ms`,
  },
  h('div', { class: 'pair' },
    flipCard('yours', r.yours, ` You · ${CARD_LABEL[r.yours]}`, r.matchup === 'won'),
    h('span', { class: 'vs' }, 'v'),
    flipCard('theirs', r.theirs, ` ${CARD_LABEL[r.theirs]} · ${opponent}`, r.matchup === 'lost'),
    h('span', { class: 'flash', 'aria-hidden': 'true' })),
  h('strong', { class: 'verdict', 'aria-live': 'polite' }, VERDICT[r.matchup]));
}

/** Hold face down, flip both, pop the verdict. Same waits with reduced motion: the flip and the pop are then cuts. */
export async function playReveal(el: HTMLElement, alive: () => boolean): Promise<void> {
  await sleep(P.holdSec);
  if (!alive()) return;
  el.classList.replace('is-facedown', 'is-flipped');
  await sleep(P.flipSec + P.verdictSec);
  if (!alive()) return;
  el.querySelector('.verdict')?.classList.add('is-popped');
  if (!prefersReducedMotion()) el.classList.add('is-clash');
}
