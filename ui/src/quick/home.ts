// The ladder: where you stand, how far the next place is, who is next. One button to play.
import { createPlayer, defaultAllocation, newLadder, opponentScouting, quickHomeView, resumeQuick, startQuick, STYLE_BLURB, STYLE_LABEL, type CreatableStyle } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';
import { icon } from '../lib/icons.ts';
import { planPicker } from './plan.ts';

const STYLES: CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

export function quickHome(ctx: Ctx): Screen {
  if (!ctx.quick) return startForm(ctx);
  const v = quickHomeView(ctx.quick);
  const picker = planPicker();
  const scout = opponentScouting(ctx.quick, v.opponent.id);
  // A match left in the middle resumes (its own plan); otherwise a new one starts on the picked plan.
  const resuming = !!ctx.quick.live;
  const play = () => {
    ctx.quickMatch = resuming ? resumeQuick(ctx.quick!) : startQuick(ctx.quick!, picker.plan());
    ctx.go('#/quick/match');
  };
  const fast = h('input', { type: 'checkbox', id: 'fast-mode', checked: ctx.fastMode, onchange: (e: Event) => { ctx.fastMode = (e.target as HTMLInputElement).checked; } });
  // The 3D code (Three.js, ~600 kB) loads while the player looks at the ladder, so Play starts at once.
  if (!ctx.fastMode) prefetch3d();
  const element = h('section', { class: 'quick-home' },
    h('div', { class: 'card rank-card', id: 'ladder' },
      h('div', { class: 'rank' }, h('span', { class: 'muted' }, v.name, h('span', { class: 'division', id: 'division' }, ` · Division ${v.division}`)), h('span', { class: 'rank-badge' }, icon('trophy', 36), h('strong', { id: 'quick-rank' }, `#${v.rank}`))),
      h('div', { class: 'to-next' },
        h('div', { class: 'bar' }, h('span', { class: 'fill', style: `width:${Math.round(v.progress * 100)}%` })),
        h('span', { class: 'muted', id: 'to-next' }, v.rank === 1 ? 'Top of the ladder' : `${v.toNext} pts to #${v.rank - 1}`),
        h('span', { class: 'points' }, `${v.points} pts`))),
    h('div', { class: 'card opponent', id: 'next-opponent' },
      h('span', { class: 'muted' }, 'Next opponent'),
      h('h2', null, v.opponent.name),
      h('p', { class: 'muted' }, `#${v.opponent.rank} · ${v.opponent.style} · level ${v.opponent.level.toFixed(1)} · ${v.opponent.surface} · tiebreak to 7`),
      h('p', { class: 'scouting', id: 'home-scouting' }, icon('eye', 18), h('span', { class: 'muted' }, 'Scouting: '), scout.habit),
      scout.rival ? h('p', { class: 'rival', id: 'home-rival' }, scout.rival) : null,
      // A match in progress resumes on its own plan: the picker is for the next new match.
      resuming ? h('p', { class: 'muted', id: 'resume-note' }, 'A match is in progress: resume it to play on.') : picker.element,
      h('button', { class: 'primary big', id: 'quick-play', onclick: play }, resuming ? 'Resume match' : 'Play'),
      h('label', { class: 'muted fast' }, fast, ' Fast mode (no 3D)')),
    v.recent.length ? h('div', { class: 'card' }, h('h3', null, 'Recent'),
      h('ul', { class: 'recent', id: 'recent' }, v.recent.map((r) => h('li', { class: r.won ? 'won' : 'lost' },
        `${r.won ? 'W' : 'L'} · ${r.opponent} · ${r.score} · ${r.delta >= 0 ? '+' : ''}${r.delta}`)))) : null);
  return { element };
}

function startForm(ctx: Ctx): Screen {
  const name = h('input', { id: 'quick-name', value: 'Alex Kim', maxlength: 24 });
  const blurb = h('p', { class: 'muted style-blurb', id: 'style-blurb' }, STYLE_BLURB[STYLES[0]!]);
  const style = h('select', { id: 'quick-style', onchange: () => { blurb.textContent = STYLE_BLURB[style.value as CreatableStyle]; } },
    STYLES.map((s) => h('option', { value: s }, STYLE_LABEL[s])));
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
    h('div', { class: 'form-row' }, h('label', null, 'Name', name), h('label', null, 'Style', style)),
    blurb,
    // The seed replays a ladder exactly (tests, bug reports); players never need it.
    h('details', { class: 'advanced', id: 'quick-advanced' }, h('summary', null, 'Advanced'), h('label', null, 'Seed', seed)),
    error,
    h('div', { class: 'actions' }, h('button', { class: 'primary big', id: 'quick-start', onclick: start }, 'Start the ladder')));
  return { element };
}

let prefetched = false;
/** Starts loading the broadcast module once, when the browser is idle (or soon, where it has no idle callback). */
function prefetch3d(): void {
  if (prefetched) return;
  prefetched = true;
  // A failed prefetch is harmless: Play imports the module again and reports a real failure there.
  const load = () => void import('../replay/broadcast.ts').catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2000 });
  else setTimeout(load, 500);
}
