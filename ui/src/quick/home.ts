// The ladder: where you stand, how far the next place is, who is next. One button to play.
import { createPlayer, defaultAllocation, newLadder, opponentScouting, planTip, quickHomeView, startQuick, type CreatableStyle } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { getAudio } from '../audio/session.ts';
import { soundToggle } from '../audio/toggle.ts';
import { T, U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';
import { icon } from '../lib/icons.ts';
import { planPicker } from './plan.ts';

const STYLES: CreatableStyle[] = ['big_server', 'baseliner', 'counter_puncher', 'all_court'];

export function quickHome(ctx: Ctx): Screen {
  if (!ctx.quick) return startForm(ctx);
  const v = quickHomeView(ctx.quick, T);
  const scout = opponentScouting(ctx.quick, v.opponent.id, T);
  const tip = planTip(ctx.quick.world.players.find((p) => p.id === v.opponent.id)!.style);
  const picker = planPicker(tip && scout.plan ? { plan: tip, line: scout.plan } : null);
  const sound = soundToggle();
  const play = () => {
    // The tap that starts the match also starts the audio (iOS allows it only inside a gesture).
    if (!ctx.fastMode) getAudio().unlock();
    ctx.quickMatch = startQuick(ctx.quick!, picker.plan());
    ctx.go('#/quick/match');
  };
  const fast = h('input', { type: 'checkbox', id: 'fast-mode', checked: ctx.fastMode, onchange: (e: Event) => { ctx.fastMode = (e.target as HTMLInputElement).checked; } });
  const element = h('section', { class: 'quick-home' },
    h('div', { class: 'home-tools' }, sound.element),
    h('div', { class: 'card rank-card', id: 'ladder' },
      h('div', { class: 'rank' }, h('span', { class: 'muted' }, v.name), h('span', { class: 'rank-badge' }, icon('trophy', 36), h('strong', { id: 'quick-rank' }, `#${v.rank}`))),
      h('div', { class: 'to-next' },
        h('div', { class: 'bar' }, h('span', { class: 'fill', style: `width:${Math.round(v.progress * 100)}%` })),
        h('span', { class: 'muted', id: 'to-next' }, v.rank === 1 ? U.topOfLadder : U.toNext(v.toNext, v.rank - 1)),
        h('span', { class: 'points' }, U.points(v.points)))),
    h('div', { class: 'card opponent', id: 'next-opponent' },
      h('span', { class: 'muted' }, U.nextOpponent),
      h('h2', null, v.opponent.name),
      h('p', { class: 'muted' }, U.opponentLine(v.opponent.rank, v.opponent.style, v.opponent.level.toFixed(1), v.opponent.surface)),
      h('p', { class: 'scouting', id: 'home-scouting' }, icon('eye', 18), h('span', { class: 'muted' }, U.scouting), scout.habit),
      scout.rival ? h('p', { class: 'rival', id: 'home-rival' }, scout.rival) : null,
      picker.element,
      h('button', { class: 'primary big', id: 'quick-play', onclick: play }, U.play),
      h('label', { class: 'muted fast' }, fast, U.fastMode)),
    v.recent.length ? h('div', { class: 'card' }, h('h3', null, U.recent),
      h('ul', { class: 'recent', id: 'recent' }, v.recent.map((r) => h('li', { class: r.won ? 'won' : 'lost' },
        U.recentRow(r.won, r.opponent, r.score, r.delta))))) : null);
  return { element, dispose: sound.dispose };
}

function startForm(ctx: Ctx): Screen {
  const name = h('input', { id: 'quick-name', value: 'Alex Kim', maxlength: 24 });
  const style = h('select', { id: 'quick-style' }, STYLES.map((s) => h('option', { value: s }, T.style[s])));
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
    h('h2', null, U.startTitle),
    h('p', { class: 'muted' }, U.startRules),
    h('div', { class: 'form-row' }, h('label', null, U.name, name), h('label', null, U.style, style), h('label', null, U.seed, seed)),
    error,
    h('div', { class: 'actions' }, h('button', { class: 'primary big', id: 'quick-start', onclick: start }, U.startLadder)));
  return { element };
}
