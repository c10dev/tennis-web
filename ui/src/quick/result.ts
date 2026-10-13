// After the match (ADR-017): the decisive point replayed (3D, or a play-by-play in fast mode) with the choice named,
// then the result, the points counting up, the players passed, the ratings that rose, the next goal and [Play again].
// Motion (ADR-021): the tiles rise 120 ms apart, the points count up with an ease-out, the names passed slide in, each
// rating that rose ticks up, the goal locks in. Click, space or Enter skips to the end; reduced motion starts there.
// Every final text is in the page from the start; the reveal only shows it.
import { QUICK_REWARD, quickResultView, resumeQuick, startQuick } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';
import { glyph, icon } from '../lib/icons.ts';
import { countUp, createSequence, onSkipInput, prefersReducedMotion, signed, stagger } from '../lib/motion.ts';
import { announce } from '../lib/announce.ts';
import { appSound } from '../lib/sound.ts';
import { savedPlan } from './plan.ts';
import { replayDecisive } from './result-replay.ts';

const R = QUICK_REWARD.reveal;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const phase = (p: string) => {
  document.body.dataset.resultPhase = p;
};

export function quickResult(ctx: Ctx): Screen {
  if (!ctx.quick?.history.length) {
    ctx.redirect('#/quick');
    return { element: h('div') };
  }
  const v = quickResultView(ctx.quick);
  const record = ctx.quick.history.at(-1)!;
  // A match in progress (left with Back) resumes; only a finished one makes room for a new match.
  const again = () => {
    ctx.quickMatch = resumeQuick(ctx.quick!) ?? startQuick(ctx.quick!, savedPlan());
    ctx.go('#/quick/match');
  };
  const step = (cls: string, id: string, ...children: Parameters<typeof h>[2][]) => h('div', { class: `step ${cls}`, id }, ...children);
  const lines = v.playByPlay.map((t) => h('li', { class: 'pbp' }, t));
  const decisive = step('decisive', 'decisive', h('span', { class: 'kicker' }, v.decisive.user ? 'The decisive point' : 'The last point'),
    h('ol', { id: 'play-by-play', class: ctx.fastMode ? '' : 'compact' }, lines),
    h('p', { id: 'decisive-line', class: v.decisive.won ? 'you' : 'them' }, v.decisive.line));
  const count = h('strong', { 'aria-hidden': 'true' }, signed(v.delta));
  const headline = step('headline', 'headline', h('h1', null, v.headline), h('p', { class: 'muted' }, `against ${v.opponent}`),
    v.won && v.streak.current >= 2 ? h('p', { class: `streak${v.streak.milestone ? ' is-milestone' : ''}`, id: 'streak' }, icon('flame', 20), h('strong', null, `${v.streak.current} wins in a row`)) : null);
  const gains = step('gains', 'gains',
    h('div', { class: 'gain', id: 'points-delta' }, count, h('span', { class: 'sr-only' }, `${signed(v.delta)} points`), h('span', { class: 'muted' }, 'points')),
    h('div', { class: 'gain', id: 'rank-change' }, h('strong', null, `#${v.rankBefore} `, glyph('arrow-right', '→'), ` #${v.rankAfter}`), h('span', { class: 'muted' }, 'ranking')),
    h('div', { class: 'gain', id: 'next-place' }, h('strong', null, v.rankAfter === 1 ? 'Top!' : `${v.toNext}`), h('span', { class: 'muted' }, v.rankAfter === 1 ? '' : `pts to #${v.rankAfter - 1}`)));
  const overtakes = v.overtakes.length
    ? step('overtakes', 'overtakes', h('span', { class: 'kicker' }, 'Passed'), h('ul', null, v.overtakes.map((o) => h('li', { class: 'overtake' }, h('strong', null, `#${o.rank}`), ` ${o.name}`))))
    : null;
  const ratings = step('ratings card', 'rating-gains', h('h3', null, 'Training from this match'),
    v.ratings.map((r) => h('div', { class: `rating-gain${r.rose ? ' rose' : ''}` },
      h('span', { class: 'label' }, r.label),
      r.rose
        ? h('span', { class: 'value' }, h('span', { class: 'from' }, String(r.before)), ' ', glyph('arrow-right', '→'), ' ', h('span', { class: 'to' }, String(r.after)), glyph('chevrons-up', '▲', 'up tick'))
        : h('span', { class: 'value' }, String(r.after)),
      h('span', { class: 'bar' }, h('span', { class: 'fill', style: `--from:${pct(r.fillBefore)};--to:${pct(r.fill)}` })))));
  const goal = step('goal', 'next-goal', h('span', { class: 'kicker' }, 'Next goal'), h('strong', null, v.goalLine));
  const actions = h('div', { class: 'actions' },
    h('button', { class: 'primary big', id: 'play-again', onclick: again }, 'Play again'),
    h('button', { id: 'to-ladder', onclick: () => ctx.go('#/quick') }, 'Ladder'));
  const element = h('section', { class: `quick-result ${v.won ? 'won' : 'lost'}`, id: 'quick-result', style: `--stagger-rise:${R.staggerSec * 1000}ms` },
    decisive, headline, gains, overtakes, ratings, goal, actions,
    h('p', { class: 'muted skip-hint' }, 'Click, Space or Enter to skip'));
  for (const list of [gains.querySelectorAll('.gain'), overtakes?.querySelectorAll('.overtake') ?? [], ratings.querySelectorAll('.rating-gain')]) stagger(list as Iterable<HTMLElement>);
  const rose = [...ratings.querySelectorAll<HTMLElement>('.rating-gain.rose')];

  const seq = createSequence();
  const sound = appSound();
  const show = (el: HTMLElement | null) => el?.classList.add('shown');
  const showAll = () => {
    for (const el of element.querySelectorAll<HTMLElement>('.step, .pbp')) show(el);
    for (const el of rose) el.classList.add('is-ticked');
    goal.classList.add('is-locked');
    decisive.classList.add('collapsed');
    element.classList.add('done');
  };
  seq.onSkip(showAll);
  /** The reveal, step by step; a skip ends it (skip() shows everything at once). */
  async function run() {
    const steps: [string, HTMLElement | null, () => Promise<void>][] = [
      ['result', headline, () => seq.wait(R.stepSec)],
      // Each new number ticks, climbing over the count (falling for a loss) (ADR-023).
      ['points', gains, () => countUp(count, v.delta, R.countSec, seq, signed, 0,
        (x) => sound.ui({ kind: 'tick', i: Math.abs(x) - 1, n: Math.abs(v.delta), down: v.delta < 0 }))],
      ['overtakes', overtakes, () => seq.wait(R.stepSec + R.staggerSec * v.overtakes.length)],
      ['ratings', ratings, tickRatings],
      ['goal', goal, lockGoal],
    ];
    phase('replay');
    show(decisive);
    if (ctx.fastMode) {
      for (const li of lines) {
        show(li);
        await seq.wait(R.lineSec);
      }
    } else await replayDecisive(seq, {
      host: element, recipe: record.recipe, point: v.decisive.point, score: v.decisive.score, line: v.decisive.line, sound, onPlay: () => phase('replay-3d'),
    });
    for (const li of lines) show(li);
    await seq.wait(R.holdSec);
    decisive.classList.add('collapsed');
    for (const [name, el, then] of steps) {
      if (seq.skipped) return;
      if (!el) continue;
      phase(name);
      show(el);
      await then();
    }
    if (!seq.skipped) finish();
  }

  /** Once the rows have risen, each rating that rose ticks up to its new number, one after another. */
  async function tickRatings() {
    await seq.wait(R.staggerSec * v.ratings.length);
    for (const [i, el] of rose.entries()) {
      if (seq.skipped) return;
      const r = v.ratings.filter((x) => x.rose)[i]!;
      el.classList.add('is-ticked');
      sound.ui({ kind: 'rise' });
      await countUp(el.querySelector<HTMLElement>('.to')!, r.after, R.tickSec, seq, String, r.before);
    }
    await seq.wait(R.stepSec);
  }

  async function lockGoal() {
    await seq.wait(R.lockSec);
    goal.classList.add('is-locked');
    if (!seq.skipped) sound.ui({ kind: 'stamp' });
    await seq.wait(R.stepSec);
  }

  function finish() {
    showAll();
    phase('done');
    // The whole result in one line for screen readers, once the reveal has ended (or been skipped).
    announce(`${v.headline} against ${v.opponent}. ${signed(v.delta)} points, now #${v.rankAfter}. Next goal: ${v.goalLine}.`);
    requestAnimationFrame(() => element.querySelector<HTMLButtonElement>('#play-again')?.focus());
  }

  /** Jumps to the end state: every animation cut (.is-skipped), final numbers, Play again focused. */
  const skip = () => {
    if (element.classList.contains('done')) return;
    element.classList.add('is-skipped');
    seq.skip();
    finish();
    // A skip lands on the end state with one sound: the goal's stamp.
    sound.ui({ kind: 'stamp' });
  };
  let unbind = onSkipInput(skip);
  const unbindOnDone = () => {
    unbind();
    unbind = () => {};
  };
  seq.onSkip(unbindOnDone);
  // From the first frame, so the screen is in the page: the first step fades in and focus can land.
  requestAnimationFrame(() => {
    if (element.classList.contains('done')) return;
    if (prefersReducedMotion()) skip();
    else void run().then(unbindOnDone);
  });
  return {
    element,
    dispose: () => {
      element.classList.add('done');
      seq.skip();
      unbind();
      delete document.body.dataset.resultPhase;
    },
  };
}
