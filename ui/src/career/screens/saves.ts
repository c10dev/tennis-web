// Save slots: save the current career, load or delete a slot.
import { savesView, type Slot } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

export async function savesScreen(ctx: Ctx): Promise<Screen> {
  const rows = savesView(await ctx.store.list());
  const message = h('p', { class: 'muted', id: 'saves-message' });
  const run = (fn: () => Promise<void>, done: string) => () => fn().then(() => { message.textContent = done; }, (e: Error) => { message.textContent = e.message; });
  const refresh = () => ctx.go('#/saves');
  const element = h('section', null, h('h2', null, 'Saves'),
    h('table', { class: 'saves', id: 'saves' }, h('tbody', null, rows.map((r) => h('tr', { dataset: { slot: r.slot } },
      h('th', null, r.label), h('td', null, r.detail),
      h('td', null,
        ctx.state && r.slot !== 'auto' ? h('button', { class: 'save', onclick: run(async () => { await ctx.saveSlot(r.slot as Slot); refresh(); }, `Saved to ${r.label}.`) }, 'Save here') : null,
        !r.empty ? h('button', { class: 'load', onclick: run(() => ctx.loadSlot(r.slot as Slot), '') }, 'Load') : null,
        !r.empty ? h('button', { class: 'delete', onclick: run(async () => { await ctx.store.remove(r.slot as Slot); refresh(); }, 'Deleted.') }, 'Delete') : null))))),
    message);
  return { element };
}
