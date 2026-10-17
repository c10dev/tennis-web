// After the match (ADR-017): the decisive point replayed (3D, or a play-by-play in fast mode) with the choice named,
// then the result, the points counting up, the players passed, the ratings that rose, the next goal and [Play again].
// Motion (ADR-021): the tiles rise 120 ms apart, the points count up with an ease-out, the names passed slide in, each
// rating that rose ticks up, the goal locks in. Click, space or Enter skips to the end; reduced motion starts there.
// Sound (TD-047, ADR-027): the stinger as the result shows (or on a skip), a rising tick as each count-up climbs.
// Every final text is in the page from the start; the reveal only shows it.
import { SCHEMA_VERSION, replayMatch, type PointEvent } from '@tennis/engine';
import { QUICK_PACE, QUICK_REWARD, quickResultView, startQuick } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { appSound } from '../audio/session.ts';
import { T, U } from '../i18n/index.ts';
import { buzz } from '../lib/haptics.ts';
import { h } from '../lib/h.ts';
import { countUp, createSequence, onSkipInput, prefersReducedMotion, signed, stagger, type Sequence } from '../lib/motion.ts';

const R = QUICK_REWARD.reveal;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const phase = (p: string) => {
  document.body.dataset.resultPhase = p;
};

export function quickResult(ctx: Ctx): Screen {
  if (!ctx.quick?.history.length) {
    ctx.go('#/quick');
    return { element: h('div') };
  }
  const v = quickResultView(ctx.quick, T);
  buzz(v.won ? 'win' : 'loss');
  const record = ctx.quick.history.at(-1)!;
  const again = () => {
    ctx.quickMatch = startQuick(ctx.quick!);
    ctx.go('#/quick/match');
  };
  const step = (cls: string, id: string, ...children: Parameters<typeof h>[2][]) => h('div', { class: `step ${cls}`, id }, ...children);
  const lines = v.playByPlay.map((t) => h('li', { class: 'pbp' }, t));
  // A conceded match (ADR-022) has no decisive point: the result starts at the headline.
  const moment = v.decisive;
  const decisive = moment && step('decisive', 'decisive', h('span', { class: 'kicker' }, moment.user ? U.decisivePoint : U.lastPoint),
    h('ol', { id: 'play-by-play', class: ctx.fastMode ? '' : 'compact' }, lines),
    h('p', { id: 'decisive-line', class: moment.won ? 'you' : 'them' }, moment.line));
  const count = h('strong', { 'aria-hidden': 'true' }, signed(v.delta));
  const headline = step('headline', 'headline', h('h1', null, v.headline), h('p', { class: 'muted' }, U.against(v.opponent)));
  const gains = step('gains', 'gains',
    h('div', { class: 'gain', id: 'points-delta' }, count, h('span', { class: 'sr-only' }, U.pointsDelta(signed(v.delta))), h('span', { class: 'muted' }, U.pointsLabel)),
    h('div', { class: 'gain', id: 'rank-change' }, h('strong', null, `#${v.rankBefore} → #${v.rankAfter}`), h('span', { class: 'muted' }, U.ranking)),
    h('div', { class: 'gain', id: 'next-place' }, h('strong', null, v.rankAfter === 1 ? U.top : `${v.toNext}`), h('span', { class: 'muted' }, v.rankAfter === 1 ? '' : U.toPlace(v.rankAfter - 1))));
  const overtakes = v.overtakes.length
    ? step('overtakes', 'overtakes', h('span', { class: 'kicker' }, U.passed), h('ul', null, v.overtakes.map((o) => h('li', { class: 'overtake' }, h('strong', null, `#${o.rank}`), ` ${o.name}`))))
    : null;
  // A match conceded before any card teaches nothing (2026-10-17 device test): no empty card then.
  const ratings = v.ratings.length === 0 ? null : step('ratings card', 'rating-gains', h('h3', null, U.training),
    v.ratings.map((r) => h('div', { class: `rating-gain${r.rose ? ' rose' : ''}` },
      h('span', { class: 'label' }, r.label),
      r.rose
        ? h('span', { class: 'value' }, h('span', { class: 'from' }, String(r.before)), ' → ', h('span', { class: 'to' }, String(r.after)), h('span', { class: 'up tick' }, ' ▲'))
        : h('span', { class: 'value' }, String(r.after)),
      h('span', { class: 'bar' }, h('span', { class: 'fill', style: `--from:${pct(r.fillBefore)};--to:${pct(r.fill)}` })))));
  const goal = step('goal', 'next-goal', h('span', { class: 'kicker' }, U.nextGoal), h('strong', null, v.goalLine));
  const actions = h('div', { class: 'actions' },
    h('button', { class: 'primary big', id: 'play-again', onclick: again }, U.playAgain),
    h('button', { id: 'to-ladder', onclick: () => ctx.go('#/quick') }, U.ladder));
  const element = h('section', { class: `quick-result ${v.won ? 'won' : 'lost'}`, id: 'quick-result', style: `--stagger-rise:${R.staggerSec * 1000}ms` },
    decisive, headline, gains, overtakes, ratings, goal, actions,
    h('p', { class: 'muted skip-hint' }, matchMedia('(pointer: coarse)').matches ? U.skipHintTouch : U.skipHint));
  for (const list of [gains.querySelectorAll('.gain'), overtakes?.querySelectorAll('.overtake') ?? [], ratings?.querySelectorAll('.rating-gain') ?? []]) stagger(list as Iterable<HTMLElement>);
  const rose = [...(ratings?.querySelectorAll<HTMLElement>('.rating-gain.rose') ?? [])];

  const seq = createSequence();
  const sound = appSound();
  const show = (el: HTMLElement | null) => el?.classList.add('shown');
  const showAll = () => {
    for (const el of element.querySelectorAll<HTMLElement>('.step, .pbp')) show(el);
    for (const el of rose) el.classList.add('is-ticked');
    goal.classList.add('is-locked');
    decisive?.classList.add('collapsed');
    element.classList.add('done');
  };
  seq.onSkip(showAll);
  /** The reveal, step by step; a skip ends it (skip() shows everything at once). */
  async function run() {
    const steps: [string, HTMLElement | null, () => Promise<void>][] = [
      // The stinger as the headline shows (ADR-027): the generated sample once loaded, else its stand-in notes.
      ['result', headline, () => {
        sound.ui({ kind: 'sting', won: v.won });
        return seq.wait(R.stepSec);
      }],
      // Each new number ticks, climbing over the count (falling for a loss) (ADR-029).
      ['points', gains, () => countUp(count, v.delta, R.countSec, seq, signed, 0,
        (x) => sound.ui({ kind: 'tick', i: Math.abs(x) - 1, n: Math.abs(v.delta), down: v.delta < 0 }))],
      ['overtakes', overtakes, () => seq.wait(R.stepSec + R.staggerSec * v.overtakes.length)],
      ['ratings', ratings, tickRatings],
      ['goal', goal, lockGoal],
    ];
    if (moment && decisive) {
      phase('replay');
      show(decisive);
      if (ctx.fastMode) {
        for (const li of lines) {
          show(li);
          await seq.wait(R.lineSec);
        }
      } else await replay3d(seq, moment);
      for (const li of lines) show(li);
      await seq.wait(R.holdSec);
      decisive.classList.add('collapsed');
    }
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

  /** The decisive point in 3D, full screen with the line as a caption; removed when it ends or on skip. */
  async function replay3d(s: Sequence, moment: NonNullable<typeof v.decisive>) {
    const stage = h('div', { class: 'decisive-replay', id: 'decisive-replay' });
    const caption = h('div', { class: 'replay-caption' }, h('span', { class: 'kicker' }, `${U.decisivePoint} · ${moment.score}`), h('strong', null, moment.line));
    element.append(stage);
    const { mountBroadcast } = await import('../replay/broadcast.ts');
    const slice = await (await import('../replay/model.ts')).sliceFromQuery();
    if (s.skipped) {
      stage.remove();
      return;
    }
    const broadcast = mountBroadcast(stage, { mode: 'full', controls: false, bare: true, sound, ...(slice ?? {}) });
    stage.append(caption);
    let open = true;
    const close = () => {
      if (!open) return;
      open = false;
      broadcast.dispose();
      stage.remove();
    };
    s.onSkip(close);
    if (s.skipped) return;
    const timeline = broadcast.load({ schemaVersion: SCHEMA_VERSION, config: record.recipe.config, events: replayMatch(record.recipe).events });
    const seg = timeline.segments.find((x) => x.point.index === moment.point)!;
    const p: PointEvent = seg.point;
    await broadcast.ready();
    if (s.skipped) return;
    phase('replay-3d');
    await broadcast.playWindow(seg.zero + Math.max(-QUICK_PACE.tossSec, p.durationSec - QUICK_PACE.keyMaxSec), seg.zero + p.durationSec, R.replaySpeed);
    await s.wait(R.holdSec);
    if (!s.skipped) close();
  }

  function finish() {
    showAll();
    phase('done');
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
