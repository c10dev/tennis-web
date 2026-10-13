// Start screen: the quick-match ladder first (ADR-014), then the season mode.
import { quickHomeView } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export async function titleScreen(ctx: Ctx): Promise<Screen> {
  const saves = await ctx.store.list();
  const auto = saves.find((s) => s.slot === 'auto');
  const error = h('p', { class: 'error', id: 'error' });
  const ladder = ctx.quick ? quickHomeView(ctx.quick) : null;
  const element = h('section', { class: 'title' },
    h('h1', null, 'TennisSim'),
    h('p', { class: 'muted' }, 'Read your opponent. Win the point. Climb the ladder.'),
    h('div', { class: 'actions stack' },
      h('button', { class: 'primary big', id: 'quick-match', onclick: () => ctx.go('#/quick') },
        ladder ? `Quick match · #${ladder.rank} · ${ladder.matches} played` : 'Quick match'),
      h('div', { class: 'season-row' },
        h('span', { class: 'muted' }, 'Season mode:'),
        h('button', { id: 'new-career', onclick: () => ctx.go('#/new') }, 'New career'),
        auto ? h('button', { id: 'continue', onclick: () => ctx.loadSlot('auto').catch((e: Error) => { error.textContent = e.message; }) },
          `Continue ${auto.name} · week ${auto.week}`) : null,
        saves.length ? h('button', { id: 'load', onclick: () => ctx.go('#/saves') }, 'Load a save') : null)),
    error);
  return { element };
}
