// A quick match (ADR-017): points without cards tick by on the score; at a decision point the match stops, the
// opponent read shows, the user picks a card (keys 1/2/3), both cards are revealed and the point plays in 3D (or as
// text in fast mode). The 3D code loads only when it is used. In 3D the match plays the hybrid edit (ADR-030): the
// opening points as units behind wipes, then from the point before the first decision on one continuous picture.
import { SCHEMA_VERSION, type Card } from '@tennis/engine';
import type { Timeline } from '@tennis/renderer';
import {
  autoPlay, batchPlan, cardChoices, concedeQuick, decide, DECISION_SHOWN, decisionSituation, finishQuick, matchOver, opponentRead, QUICK_PACE, revealView, scoreLine,
  tickerView,
} from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { appSound } from '../audio/session.ts';
import { T, U } from '../i18n/index.ts';
import { confirmDialog, dialogOpen } from '../lib/confirm.ts';
import { buzz } from '../lib/haptics.ts';
import { h } from '../lib/h.ts';
import { cardIcon } from '../lib/icons.ts';
import { stagger } from '../lib/motion.ts';
import { playReveal, revealElement } from './reveal.ts';
import { renderRead } from './scout.ts';
import { pointPlayer } from './points.ts';
import { createWipe } from './wipe.ts';
import { createCaption } from './caption.ts';
import { lastPoint, pipRow, tickerAfter, tickerAtStart } from './ticker.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function quickMatchScreen(ctx: Ctx): Promise<Screen> {
  const qm = ctx.quickMatch;
  if (!qm || matchOver(qm)) {
    ctx.go('#/quick');
    return { element: h('div') };
  }
  const stage = h('div');
  const panel = h('div', { class: 'quick-panel', id: 'quick-panel' });
  // iPhones have no back button (2026-10-17 device test): the match carries its own way out, behind the same question.
  const leave = h('button', { type: 'button', class: 'leave-match', id: 'leave-match', onclick: () => void askToLeave() }, U.leaveMatch);
  const element = h('div', { class: `quick-match${ctx.fastMode ? ' fast' : ''}` }, stage, panel, leave);
  const sound = appSound();
  // The 3D redesign (ADR-024; `?rig=mannequin` for the M7 look): skinned players, the game camera and its decision hold.
  const slice = ctx.fastMode ? null : await (await import('../replay/model.ts')).sliceFromQuery();
  // The captions (E5) follow the frames in match time; fast mode has no stage for them.
  const caption = ctx.fastMode ? null : createCaption();
  const broadcast = ctx.fastMode ? null : (await import('../replay/broadcast.ts')).mountBroadcast(stage, {
    mode: 'full', controls: false, bare: true, sound, ...(slice ?? {}), onFrame: (f, _c, p) => caption!.frame(p.timeline, f.matchT) });
  const wipe = broadcast ? createWipe() : null;
  if (wipe) stage.append(caption!.element, wipe.element);
  const play = broadcast ? pointPlayer(broadcast, () => timeline!) : null;
  /** The deal sounds, one per card on the CSS deal stagger (motion.css: 120 ms, then 60 ms apart); cut short by a pick. */
  let deals: ReturnType<typeof setTimeout>[] = [];
  const stopDeals = () => {
    deals.forEach(clearTimeout);
    deals = [];
  };
  const opponent = qm.recipe.config.players[1].name;
  let busy = false;
  let disposed = false;
  const phase = (p: string) => {
    caption?.live(p === 'auto' || p === 'clip' || p === 'outcome');
    Object.assign(document.body.dataset, { quickPhase: p, quickPoints: String(qm.recipe.cards.length), quickDecisions: String(qm.decisions.length) });
  };

  /** Plays on to the next decision point, ticking each point by; then the choose screen, or the result. */
  async function run() {
    const decided = qm!.decisions.length > 0;
    // The panel is never empty: before the first point ends it shows who plays, the plan and 0-0 (device test).
    if (!lastPoint(qm!)) panel.replaceChildren(tickerAtStart(qm!, opponent));
    const points = autoPlay(qm!);
    if (broadcast) {
      load();
      await broadcast.ready();
    }
    const plan = batchPlan(points.length, decided, !matchOver(qm!));
    for (const [k, p] of points.entries()) {
      if (disposed) return;
      phase('auto');
      if (broadcast) {
        const shown = plan[k]!;
        if (shown.wipe) await wipe!.play(tickerView(qm!, points[k - 1]!, T).score, () => play!.seekTo(p));
        if (!disposed) await play!.play(p, shown);
      }
      if (disposed) return;
      panel.replaceChildren(tickerAfter(qm!, opponent, p));
      // Fast mode ticks each point by; in 3D the next point's walk back is the beat.
      if (!broadcast) await sleep(QUICK_PACE.autoSec * 1000);
    }
    if (disposed) return;
    if (matchOver(qm!)) {
      await sleep(QUICK_PACE.autoSec * 1000);
      if (disposed) return;
      const next = finishQuick(ctx.quick!, qm!);
      ctx.quickMatch = null;
      await ctx.setQuick(next, '#/quick/result');
      return;
    }
    // The walk to the next point's start plays into the hold (the decision point when two stops come in a row).
    const last = lastPoint(qm!);
    if (play && last) await play.walkOn(last);
    if (disposed) return;
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
        h('span', { class: 'strength', title: U.strengthHint, role: 'img', 'aria-label': U.strengthHint }, h('span', { class: 'fill', style: `width:${Math.min(100, Math.round(c.strength * 60))}%` }))))));
    stagger(panel.querySelectorAll<HTMLElement>('.card-btn'));
    deals = [0, 1, 2].map((i) => setTimeout(() => sound.ui({ kind: 'deal', i }), 120 + 60 * i));
    // While the cards are up, the slice holds a shot of the opponent waiting for the point, whose body shows the tell
    // (TD-061).
    const tell = qm!.pending?.tell;
    // The game camera cuts to a tell shot; the fixed TV view stays on the main camera, both at the next point's start.
    const ready = { tell: tell ? { player: 'B' as const, card: tell.card, index: tell.index } : null };
    if (slice?.style === 'game') broadcast?.hold({ camera: 'tell', focus: 'B', ready });
    else broadcast?.hold({ camera: 'main', ready });
    phase('choose');
  }

  async function choose(card: Card) {
    if (busy || !qm!.pending) return;
    busy = true;
    buzz('pick');
    const { cards, point } = decide(qm!, card);
    const r = revealView(cards, point, T);
    stopDeals();
    sound.ui({ kind: 'pick' });
    phase('reveal');
    // The picked card rises above the others for a beat, then both cards go face down (ADR-021).
    panel.querySelector('.cards')?.classList.add('is-picked');
    panel.querySelector(`#card-${card}`)?.classList.add('is-selected');
    await sleep(QUICK_PACE.reveal.selectSec * 1000);
    if (disposed) return;
    panel.classList.remove('stop');
    const reveal = revealElement(r, opponent);
    panel.replaceChildren(reveal);
    await playReveal(reveal, () => !disposed, (cue) => sound.ui(cue));
    if (!disposed) buzz(r.matchup === 'won' ? 'read' : r.matchup === 'lost' ? 'misread' : 'same');
    if (broadcast && !disposed) {
      load();
      broadcast.hold(null);
      await broadcast.ready();
      if (disposed) return;
      phase('clip');
      await play!.play(point, DECISION_SHOWN);
    }
    if (disposed) return;
    panel.querySelector('#reveal')?.append(h('p', { class: `outcome ${r.winner}`, id: 'outcome' }, `${r.how} · ${U.pointFor(r.winner === 'you').toLocaleLowerCase()} · ${scoreLine(qm!)}`));
    phase('outcome');
    // In 3D the outcome stays up while the walk back plays on; fast mode holds it for a beat.
    if (!broadcast) await sleep(QUICK_PACE.scoreSec * 1000);
    busy = false;
    if (!disposed) await run();
  }

  /** Loads the match so far into the broadcast (after new points were played). */
  let timeline: Timeline | null = null;
  const load = () => {
    timeline = broadcast!.load({ schemaVersion: SCHEMA_VERSION, config: qm!.live.config, events: [...qm!.live.events] }, { keepTime: true });
  };

  const onKey = (e: KeyboardEvent) => {
    if (dialogOpen()) return;
    const card = ({ Digit1: 'attack', Digit2: 'defend', Digit3: 'counter' } as Record<string, Card>)[e.code];
    if (card) void choose(card);
  };
  window.addEventListener('keydown', onKey);
  /** Stop the flow where it is (every await checks `disposed`), then settle the match as a conceded loss. */
  function concede() {
    if (disposed || matchOver(qm!)) return;
    disposed = true;
    const next = concedeQuick(ctx.quick!, qm!);
    ctx.quickMatch = null;
    void ctx.setQuick(next, '#/quick/result');
  }
  async function askToLeave() {
    if (await confirmDialog(U.concede)) concede();
  }
  void run();
  return {
    element, bare: true,
    concede,
    dispose: () => {
      disposed = true;
      stopDeals();
      window.removeEventListener('keydown', onKey);
      broadcast?.dispose();
      // A match left mid-wipe must not leave the flag up (the next match's chip, the continuity e2e).
      document.body.dataset.wipe = '';
    },
  };
}
