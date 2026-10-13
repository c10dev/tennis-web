// A finished tournament: champion, the user's result and matches (replayable from their recipes).
import { historyView } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export function historyScreen(ctx: Ctx, params: string[]): Screen {
  const s = ctx.state!;
  const index = Number(params[0]);
  if (!(index >= 0 && index < s.history.length)) {
    ctx.go('#/home');
    return { element: h('div') };
  }
  const v = historyView(s, index);
  const element = h('section', { class: 'card', id: 'history' },
    h('h2', null, v.name, h('span', { class: 'muted' }, ` · ${v.tier} · ${v.surface} · week ${v.week}`)),
    h('p', null, `Champion: ${v.champion}`),
    h('p', null, v.userResult ? `You: ${v.userResult}` : 'You did not play.'),
    v.userMatches.length ? h('table', { class: 'matches' }, h('tbody', null, v.userMatches.map((m) => h('tr', null,
      h('td', null, m.round), h('td', null, `${m.won ? 'Beat' : 'Lost to'} ${m.opponent}`), h('td', null, m.score),
      h('td', null, m.replayable ? h('button', { id: `replay-${m.index}`, onclick: () => ctx.go(`#/match/replay/${index}/${m.index}`) }, 'Watch replay') : null))))) : null);
  return { element };
}
