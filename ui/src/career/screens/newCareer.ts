// Player creation (GDD §9.1): name, style, and ratings spread over a budget.
import { createPlayer, CREATION, defaultAllocation, EDITABLE, newSeason, STYLE_LABEL, toSave, type Allocation, type CreatableStyle } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';

const STYLES: CreatableStyle[] = ['baseliner', 'big_server', 'counter_puncher', 'all_court'];
const LABEL = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function newCareerScreen(ctx: Ctx): Screen {
  let style: CreatableStyle = 'baseliner';
  let allocation: Allocation = defaultAllocation(style);
  const name = h('input', { id: 'name', value: 'Alex Kim', maxlength: 24 });
  const seed = h('input', { id: 'seed', type: 'number', min: 0, value: String(Math.floor(Math.random() * 2 ** 31)) });
  const left = h('strong', { id: 'budget-left' });
  const ratings = h('div', { class: 'ratings-grid' });
  const error = h('p', { class: 'error', id: 'error' });
  const refreshLeft = () => {
    const spent = EDITABLE.reduce((a, k) => a + allocation[k], 0);
    left.textContent = String(CREATION.budget - spent);
    left.classList.toggle('over', spent > CREATION.budget);
  };
  const drawRatings = () => {
    ratings.replaceChildren(...EDITABLE.map((k) => h('label', null, LABEL(k),
      h('input', {
        id: `rate-${k}`, type: 'number', min: CREATION.min, max: CREATION.max, value: String(allocation[k]),
        oninput: (e: Event) => {
          allocation = { ...allocation, [k]: Number((e.target as HTMLInputElement).value) };
          refreshLeft();
        },
      }))));
    refreshLeft();
  };
  const styleSelect = h('select', {
    id: 'style',
    onchange: (e: Event) => {
      style = (e.target as HTMLSelectElement).value as CreatableStyle;
      allocation = defaultAllocation(style);
      drawRatings();
    },
  }, STYLES.map((s) => h('option', { value: s, selected: s === style }, STYLE_LABEL[s])));
  drawRatings();
  const start = async () => {
    try {
      const s = Number(seed.value) >>> 0;
      const state = newSeason(s, createPlayer({ name: name.value, style, allocation }, s));
      await ctx.store.save('auto', toSave(state, new Date().toISOString().slice(0, 16).replace('T', ' ')));
      ctx.set(state, `Welcome to the tour, ${name.value.trim()}.`, '#/home');
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  };
  const element = h('section', { class: 'card new-career' },
    h('h2', null, 'New career'),
    h('div', { class: 'form-row' }, h('label', null, 'Name', name), h('label', null, 'Style', styleSelect), h('label', null, 'Career seed', seed)),
    h('p', { class: 'muted' }, `Every rating from ${CREATION.min} to ${CREATION.max}. Points left: `, left),
    ratings, error,
    h('div', { class: 'actions' }, h('button', { class: 'primary', id: 'start', onclick: () => void start() }, 'Start career'),
      h('button', { onclick: () => ctx.go('#/') }, 'Back')));
  return { element };
}
