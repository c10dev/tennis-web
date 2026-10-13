// A player's card: ratings by area (with training progress), condition and results.
import { playerView } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export function playerScreen(ctx: Ctx, params: string[]): Screen {
  const s = ctx.state!;
  const id = params[0] ?? 'user';
  if (!s.world.players.some((p) => p.id === id)) {
    ctx.go('#/rankings');
    return { element: h('div') };
  }
  const v = playerView(s, id);
  const element = h('section', { class: 'player', id: 'player' },
    h('h2', null, v.name, h('span', { class: 'muted' }, ` · ${v.age} · ${v.style} · level ${v.overall.toFixed(1)}`)),
    h('p', null, `Condition: ${v.injuryWeeks ? `injured, ${v.injuryWeeks} more week${v.injuryWeeks === 1 ? '' : 's'}` : v.fatigue}`,
      v.potential ? h('span', { class: 'potential', title: 'Scouting estimate' }, ` · Potential ${v.potential}`) : null),
    h('div', { class: 'groups' }, v.groups.map((g) => h('div', { class: 'card' }, h('h4', null, g.label),
      g.ratings.map((r) => h('div', { class: 'rating' },
        h('span', { class: 'label' }, r.label), h('span', { class: 'value' }, String(r.value)),
        h('span', { class: 'bar' }, h('span', { class: 'fill', style: `width:${(r.value / 20) * 100}%` }),
          v.isUser ? h('span', { class: 'next', style: `width:${(Math.min(1, r.progress) / 20) * 100}%` }) : null)))))),
    h('h3', null, 'This season'),
    v.results.length ? h('ul', { class: 'results' }, v.results.map((r) => h('li', null, `Week ${r.week} · ${r.name}: ${r.result}`))) : h('p', { class: 'muted' }, 'No tournaments yet.'));
  return { element };
}
