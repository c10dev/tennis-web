// A quick match (ADR-017): points without cards tick by on the score; at a decision point the match stops, the
// opponent read shows, the user picks a card (keys 1/2/3), both cards are revealed and the point plays in 3D (or as
// text in fast mode). The 3D code loads only when it is used.
import { SCHEMA_VERSION, type Card, type PointEvent } from '@tennis/engine';
import type { Timeline } from '@tennis/renderer';
import {
  autoPlay, cardChoices, clipFor, decide, decisionSituation, finishQuick, matchOver, opponentRead, QUICK_PACE, revealView, scoreLine,
  tickerView, type QuickMatch,
} from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { T, U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';
import { cardIcon } from '../lib/icons.ts';
import { stagger } from '../lib/motion.ts';
import { playReveal, revealElement } from './reveal.ts';
import { renderRead } from './scout.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One pip per point played: green yours, red theirs, ringed where you chose a card; on the ticker the newest pops in. */
const pipRow = (m: QuickMatch, p: PointEvent | undefined, popNew = false) => h('div', { class: 'pips', id: 'point-pips' },
  p ? tickerView(m, p, T).pips.map((x, i, all) => h('span', { class: `pip ${x.winner}${x.decision ? ' decision' : ''}${popNew && i === all.length - 1 ? ' is-new' : ''}` })) : []);
const lastPoint = (m: QuickMatch) => m.live.events.findLast((e): e is PointEvent => e.type === 'point');

export async function quickMatchScreen(ctx: Ctx): Promise<Screen> {
  const qm = ctx.quickMatch;
  if (!qm || matchOver(qm)) {
    ctx.go('#/quick');
    return { element: h('div') };
  }
  const stage = h('div');
  const panel = h('div', { class: 'quick-panel', id: 'quick-panel' });
  const element = h('div', { class: `quick-match${ctx.fastMode ? ' fast' : ''}` }, stage, panel);
  const broadcast = ctx.fastMode ? null : (await import('../replay/broadcast.ts')).mountBroadcast(stage, { mode: 'full', controls: false, bare: true });
  const opponent = qm.recipe.config.players[1].name;
  let busy = false;
  let disposed = false;
  const phase = (p: string) => Object.assign(document.body.dataset, { quickPhase: p, quickPoints: String(qm.recipe.cards.length), quickDecisions: String(qm.decisions.length) });

  /** Plays on to the next decision point, ticking each point by; then the choose screen, or the result. */
  async function run() {
    const points = autoPlay(qm!);
    if (broadcast && points.length) load();
    for (const p of points) {
      if (disposed) return;
      if (broadcast) await playClip(p, QUICK_PACE.autoSpeed);
      if (disposed) return;
      const v = tickerView(qm!, p, T);
      panel.replaceChildren(h('div', { class: 'ticker', id: 'ticker' },
        h('div', { class: 'situation' }, h('span', { class: 'versus' }, U.versus(opponent)), h('span', { class: 'plan muted' }, U.planTag(v.plan))),
        h('div', { class: 'tick-line' }, h('strong', { id: 'score-line', class: 'tick-score' }, v.score),
          h('span', { class: `tick-point ${v.winner}` }, `${U.pointFor(v.winner === 'you')} · ${v.how}`)),
        pipRow(qm!, p, true)));
      phase('auto');
      await sleep(QUICK_PACE.autoSec * 1000);
    }
    if (disposed) return;
    if (matchOver(qm!)) {
      const next = finishQuick(ctx.quick!, qm!);
      ctx.quickMatch = null;
      await ctx.setQuick(next, '#/quick/result');
      return;
    }
    drawChoose();
  }

  function drawChoose() {
    const sit = decisionSituation(qm!, T);
    panel.classList.add('stop');
    panel.replaceChildren(
      h('div', { class: 'moment-banner' }, h('span', { class: 'moment', id: 'moment' }, sit.moment), h('strong', { class: 'stop-score' }, scoreLine(qm!))),
      h('div', { class: 'situation' }, h('span', { class: 'versus' }, U.versus(opponent)), h('span', { id: 'situation' }, sit.line)),
      pipRow(qm!, lastPoint(qm!)),
      renderRead(opponentRead(qm!, T)),
      h('div', { class: 'cards' }, cardChoices(qm!, T).map((c, i) => h('button', { class: `card-btn ${c.card} is-dealt`, id: `card-${c.card}`, onclick: () => void choose(c.card) },
        h('span', { class: 'key' }, String(i + 1)), h('strong', null, cardIcon(c.card), ' ', c.label), h('span', { class: 'flavour' }, c.flavour),
        h('span', { class: 'rule' }, U.beats(T.card[c.beats])),
        h('span', { class: 'strength', title: U.strengthHint }, h('span', { class: 'fill', style: `width:${Math.min(100, Math.round(c.strength * 60))}%` }))))));
    stagger(panel.querySelectorAll<HTMLElement>('.card-btn'));
    phase('choose');
  }

  async function choose(card: Card) {
    if (busy || !qm!.pending) return;
    busy = true;
    const { cards, point } = decide(qm!, card);
    const r = revealView(cards, point, T);
    phase('reveal');
    // The picked card rises above the others for a beat, then both cards go face down (ADR-021).
    panel.querySelector('.cards')?.classList.add('is-picked');
    panel.querySelector(`#card-${card}`)?.classList.add('is-selected');
    await sleep(QUICK_PACE.reveal.selectSec * 1000);
    if (disposed) return;
    panel.classList.remove('stop');
    const reveal = revealElement(r, opponent);
    panel.replaceChildren(reveal);
    await playReveal(reveal, () => !disposed);
    if (broadcast && !disposed) {
      load();
      phase('clip');
      await playClip(point, QUICK_PACE.speed);
    }
    if (disposed) return;
    panel.querySelector('#reveal')?.append(h('p', { class: `outcome ${r.winner}`, id: 'outcome' }, `${r.how} · ${U.pointFor(r.winner === 'you').toLocaleLowerCase()} · ${scoreLine(qm!)}`));
    phase('outcome');
    await sleep(QUICK_PACE.scoreSec * 1000);
    busy = false;
    if (!disposed) await run();
  }

  /** Loads the match so far into the broadcast (after new points were played). */
  let timeline: Timeline | null = null;
  const load = () => {
    timeline = broadcast!.load({ schemaVersion: SCHEMA_VERSION, config: qm!.live.config, events: [...qm!.live.events] }, { keepTime: true });
  };

  /** Plays the window `clipFor` gives this point (pace.ts models the same seconds). */
  async function playClip(point: PointEvent, speed: number) {
    const seg = timeline!.segments.find((x) => x.point.index === point.index)!;
    const clip = clipFor(point);
    await broadcast!.playWindow(seg.zero + clip.fromTau, seg.zero + clip.toTau, speed);
  }

  const onKey = (e: KeyboardEvent) => {
    const card = ({ Digit1: 'attack', Digit2: 'defend', Digit3: 'counter' } as Record<string, Card>)[e.code];
    if (card) void choose(card);
  };
  window.addEventListener('keydown', onKey);
  void run();
  return {
    element, bare: true,
    dispose: () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      broadcast?.dispose();
    },
  };
}
