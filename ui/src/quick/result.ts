// After the match: the result, points gained, the rank change, the ratings that grew. One button to play again.
import { quickResultView, startQuick } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';

export function quickResult(ctx: Ctx): Screen {
  if (!ctx.quick?.history.length) {
    ctx.go('#/quick');
    return { element: h('div') };
  }
  const v = quickResultView(ctx.quick);
  const again = () => {
    ctx.quickMatch = startQuick(ctx.quick!);
    ctx.go('#/quick/match');
  };
  const element = h('section', { class: `quick-result ${v.won ? 'won' : 'lost'}`, id: 'quick-result' },
    h('h1', null, v.headline),
    h('p', { class: 'muted' }, `against ${v.opponent}`),
    h('div', { class: 'gains' },
      h('div', { class: 'gain', id: 'points-delta' }, h('strong', null, `${v.delta >= 0 ? '+' : ''}${v.delta}`), h('span', { class: 'muted' }, 'points')),
      h('div', { class: 'gain', id: 'rank-change' }, h('strong', null, `#${v.rankBefore} → #${v.rankAfter}`), h('span', { class: 'muted' }, 'ranking')),
      h('div', { class: 'gain' }, h('strong', null, v.rankAfter === 1 ? 'Top!' : `${v.toNext}`), h('span', { class: 'muted' }, v.rankAfter === 1 ? '' : `pts to #${v.rankAfter - 1}`))),
    h('div', { class: 'card', id: 'rating-gains' }, h('h3', null, 'Training from this match'),
      v.ratings.map((r) => h('div', { class: `rating-gain${r.rose ? ' level-up' : ''}` },
        h('span', { class: 'label' }, r.label), h('span', { class: 'value' }, `${r.before} → ${r.after}`)))),
    h('div', { class: 'actions' },
      h('button', { class: 'primary big', id: 'play-again', autofocus: true, onclick: again }, 'Play again'),
      h('button', { id: 'to-ladder', onclick: () => ctx.go('#/quick') }, 'Ladder')));
  return { element };
}
