// The quick match's marked transitions (ADR-030, presentation spec E6): a court-blue band sweeps over the stage
// carrying the score, the clock moves on behind it, and it sweeps off. Also the ▶▶ chip shown while the walk back
// between points plays sped up (E3; the broadcast sets body[data-ff]). body[data-wipe] is set while the band is up.
import { QUICK_PACE } from '@tennis/game';
import { h } from '../lib/h.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Wipe {
  readonly element: HTMLElement;
  /** Sweeps the band on with `score`, runs `behind` (the seek) under it, sweeps it off; QUICK_PACE.hybrid.wipeSec. */
  play(score: string, behind: () => Promise<void>): Promise<void>;
}

export function createWipe(): Wipe {
  const half = (QUICK_PACE.hybrid.wipeSec / 2) * 1000;
  const label = h('strong', { class: 'wipe-score' });
  const band = h('div', { class: 'wipe', id: 'wipe', 'aria-hidden': 'true', style: `--wipe-half:${half}ms` }, label);
  const chip = h('span', { class: 'ff-chip', id: 'ff-chip', 'aria-hidden': 'true' }, '▶▶');
  return {
    element: h('div', { class: 'wipe-layer' }, band, chip),
    async play(score, behind) {
      label.textContent = score;
      document.body.dataset.wipe = '1';
      band.classList.remove('is-off');
      band.classList.add('is-on');
      await sleep(half);
      await behind();
      band.classList.replace('is-on', 'is-off');
      await sleep(half);
      band.classList.remove('is-off');
      document.body.dataset.wipe = '';
    },
  };
}
