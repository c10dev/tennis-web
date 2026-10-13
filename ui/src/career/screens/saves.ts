// Save slots: save the current career, load or delete a slot.
import { savesView, type Slot } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

/** The confirmation for the next render of this screen (a save or delete redraws the list). */
let flash: string | null = null;

export async function savesScreen(ctx: Ctx): Promise<Screen> {
  const rows = savesView(await ctx.store.list());
  const message = h('p', { class: 'muted', id: 'saves-message' }, flash ?? '');
  flash = null;
  /** Runs a slot action; `redraw` shows `done` on the redrawn list, otherwise here. */
  const run = (fn: () => Promise<void>, done: string, redraw = false) => () => fn().then(() => {
    if (!redraw) message.textContent = done;
    else {
      flash = done;
      ctx.go('#/saves');
    }
  }, (e: Error) => { message.textContent = e.message; });
  const element = h('section', null, h('h2', null, 'Saves'),
    h('table', { class: 'saves', id: 'saves' }, h('tbody', null, rows.map((r) => h('tr', { dataset: { slot: r.slot } },
      h('th', null, r.label), h('td', null, r.detail),
      h('td', null,
        ctx.state && r.slot !== 'auto' ? h('button', { class: 'save', onclick: run(() => ctx.saveSlot(r.slot as Slot), `Saved to ${r.label}.`, true) }, 'Save here') : null,
        !r.empty ? h('button', { class: 'load', onclick: run(() => ctx.loadSlot(r.slot as Slot), '') }, 'Load') : null,
        !r.empty ? h('button', { class: 'delete', onclick: run(() => ctx.store.remove(r.slot as Slot), 'Deleted.', true) }, 'Delete') : null))))),
    message);
  return { element };
}
