// The ladder: where you stand, how far the next place is, who is next. One button to play.
import { createPlayer, defaultAllocation, newLadder, opponentScouting, quickHomeView, startQuick, STYLE_LABEL, type CreatableStyle } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';

const STYLES: CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

export function quickHome(ctx: Ctx): Screen {
  if (!ctx.quick) return startForm(ctx);
  const v = quickHomeView(ctx.quick);
  const scout = opponentScouting(ctx.quick, v.opponent.id);
  const play = () => {
    ctx.quickMatch = startQuick(ctx.quick!);
    ctx.go('#/quick/match');
  };
  const fast = h('input', { type: 'checkbox', id: 'fast-mode', checked: ctx.fastMode, onchange: (e: Event) => { ctx.fastMode = (e.target as HTMLInputElement).checked; } });
  const element = h('section', { class: 'quick-home' },
    h('div', { class: 'card rank-card', id: 'ladder' },
      h('div', { class: 'rank' }, h('span', { class: 'muted' }, v.name), h('strong', { id: 'quick-rank' }, `#${v.rank}`)),
      h('div', { class: 'to-next' },
        h('div', { class: 'bar' }, h('span', { class: 'fill', style: `width:${Math.round(v.progress * 100)}%` })),
        h('span', { class: 'muted', id: 'to-next' }, v.rank === 1 ? 'Top of the ladder' : `${v.toNext} pts to #${v.rank - 1}`),
        h('span', { class: 'points' }, `${v.points} pts`))),
    h('div', { class: 'card opponent', id: 'next-opponent' },
      h('span', { class: 'muted' }, 'Next opponent'),
      h('h2', null, v.opponent.name),
      h('p', { class: 'muted' }, `#${v.opponent.rank} · ${v.opponent.style} · level ${v.opponent.level.toFixed(1)} · ${v.opponent.surface} · tiebreak to 7`),
      h('p', { class: 'scouting', id: 'home-scouting' }, h('span', { class: 'muted' }, 'Scouting: '), scout.habit),
      scout.rival ? h('p', { class: 'rival', id: 'home-rival' }, scout.rival) : null,
      h('button', { class: 'primary big', id: 'quick-play', onclick: play }, 'Play'),
      h('label', { class: 'muted fast' }, fast, ' Fast mode (no 3D)')),
    v.recent.length ? h('div', { class: 'card' }, h('h3', null, 'Recent'),
      h('ul', { class: 'recent', id: 'recent' }, v.recent.map((r) => h('li', { class: r.won ? 'won' : 'lost' },
        `${r.won ? 'W' : 'L'} · ${r.opponent} · ${r.score} · ${r.delta >= 0 ? '+' : ''}${r.delta}`)))) : null);
  return { element };
}

function startForm(ctx: Ctx): Screen {
  const name = h('input', { id: 'quick-name', value: 'Alex Kim', maxlength: 24 });
  const style = h('select', { id: 'quick-style' }, STYLES.map((s) => h('option', { value: s }, STYLE_LABEL[s])));
  const seed = h('input', { id: 'quick-seed', type: 'number', min: 0, value: String(Math.floor(Math.random() * 2 ** 31)) });
  const error = h('p', { class: 'error' });
  const start = () => {
    try {
      const s = Number(seed.value) >>> 0;
      const st = style.value as CreatableStyle;
      void ctx.setQuick(newLadder(s, createPlayer({ name: name.value, style: st, allocation: defaultAllocation(st) }, s)), '#/quick');
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  };
  const element = h('section', { class: 'card quick-start' },
    h('h2', null, 'Quick match ladder'),
    h('p', { class: 'muted' }, 'One tiebreak to seven against the players just above you. At the big points you pick a card: attack beats defend, defend beats counter, counter beats attack.'),
    h('div', { class: 'form-row' }, h('label', null, 'Name', name), h('label', null, 'Style', style), h('label', null, 'Seed', seed)),
    error,
    h('div', { class: 'actions' }, h('button', { class: 'primary big', id: 'quick-start', onclick: start }, 'Start the ladder')));
  return { element };
}
