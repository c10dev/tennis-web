// The quick match's ticker (ADR-017): who plays on what plan, the score, the last point and a pip per point played.
import { scoreLine, tickerView, type QuickMatch } from '@tennis/game';
import type { PointEvent } from '@tennis/engine';
import { T, U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';

/** One pip per point played: green yours, red theirs, ringed where you chose a card; on the ticker the newest pops in. */
export const pipRow = (m: QuickMatch, p: PointEvent | undefined, popNew = false) => h('div', { class: 'pips', id: 'point-pips' },
  p ? tickerView(m, p, T).pips.map((x, i, all) => h('span', { class: `pip ${x.winner}${x.decision ? ' decision' : ''}${popNew && i === all.length - 1 ? ' is-new' : ''}` })) : []);

export const lastPoint = (m: QuickMatch) => m.live.events.findLast((e): e is PointEvent => e.type === 'point');

const tickerEl = (opponent: string, plan: string, score: string, point: HTMLElement, pips: HTMLElement | null) => h('div', { class: 'ticker', id: 'ticker' },
  h('div', { class: 'situation' }, h('span', { class: 'versus' }, U.versus(opponent)), h('span', { class: 'plan muted' }, U.planTag(plan))),
  h('div', { class: 'tick-line' }, h('strong', { id: 'score-line', class: 'tick-score' }, score), point), pips);

/** The ticker after point `p`, its pip popping in. */
export function tickerAfter(m: QuickMatch, opponent: string, p: PointEvent): HTMLElement {
  const v = tickerView(m, p, T);
  return tickerEl(opponent, v.plan, v.score, h('span', { class: `tick-point ${v.winner}` }, `${U.pointFor(v.winner === 'you')} · ${v.how}`), pipRow(m, p, true));
}

/** The ticker before the first point has finished: the panel is never empty (2026-10-17 device test). */
export const tickerAtStart = (m: QuickMatch, opponent: string): HTMLElement =>
  tickerEl(opponent, T.plan[m.plan].label, scoreLine(m), h('span', { class: 'tick-point' }, U.firstServe), null);
