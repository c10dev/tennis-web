// Start screen: new career, continue the autosave, or pick a save.
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export async function titleScreen(ctx: Ctx): Promise<Screen> {
  const saves = await ctx.store.list();
  const auto = saves.find((s) => s.slot === 'auto');
  const error = h('p', { class: 'error', id: 'error' });
  const element = h('section', { class: 'title' },
    h('h1', null, 'TennisSim'),
    h('p', { class: 'muted' }, 'Coach a young player through a season on the tour.'),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', id: 'new-career', onclick: () => ctx.go('#/new') }, 'New career'),
      auto ? h('button', { id: 'continue', onclick: () => ctx.loadSlot('auto').catch((e: Error) => { error.textContent = e.message; }) },
        `Continue ${auto.name} · week ${auto.week}`) : null,
      saves.length ? h('button', { id: 'load', onclick: () => ctx.go('#/saves') }, 'Load a save') : null),
    error);
  return { element };
}
