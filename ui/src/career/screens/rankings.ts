// The ranking table.
import { rankingsView } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export function rankingsScreen(ctx: Ctx): Screen {
  const rows = rankingsView(ctx.state!);
  const arrow = (c: number) => (c > 0 ? `▲${c}` : c < 0 ? `▼${-c}` : '');
  const element = h('section', null, h('h2', null, 'Rankings'),
    h('table', { class: 'rankings', id: 'rankings' },
      h('thead', null, h('tr', null, ['#', '', 'Player', 'Age', 'Level', 'Points'].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((r) => h('tr', { class: r.isUser ? 'user' : '' },
        h('td', null, String(r.rank)), h('td', { class: r.change > 0 ? 'up' : r.change < 0 ? 'down' : '' }, arrow(r.change)),
        h('td', null, h('a', { href: `#/player/${r.id}` }, r.name), r.injured ? h('span', { class: 'muted' }, ' (injured)') : null),
        h('td', null, String(r.age)), h('td', null, r.level.toFixed(1)), h('td', null, String(r.points)))))));
  return { element };
}
