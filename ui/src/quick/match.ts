// A quick match (ADR-017): points without cards tick by on the score; at a decision point the match stops, the
// opponent read shows, the user picks a card (keys 1/2/3), both cards are revealed and the point plays in 3D (or as
// text in fast mode). The 3D code loads only when it is used.
import { SCHEMA_VERSION, type Card, type PointEvent } from '@tennis/engine';
import {
  autoPlay, CARD_LABEL, cardChoices, clipFor, decide, decisionSituation, finishQuick, matchOver, opponentRead, QUICK_PACE, revealView, scoreLine,
} from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';
import { renderRead } from './scout.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Seconds each point without cards stays on the ticker. */
const AUTO_SEC = 0.35;

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
    for (const p of points) {
      if (disposed) return;
      panel.replaceChildren(h('div', { class: 'situation ticker', id: 'ticker' }, h('span', { class: 'versus' }, `You v ${opponent}`),
        h('strong', { id: 'score-line' }, `${p.scoreBefore.points[0] + (p.winner === 'A' ? 1 : 0)}-${p.scoreBefore.points[1] + (p.winner === 'B' ? 1 : 0)}`),
        h('span', { class: p.winner === 'A' ? 'you' : 'them' }, p.winner === 'A' ? 'your point' : 'their point')));
      phase('auto');
      await sleep(AUTO_SEC * 1000);
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
    const sit = decisionSituation(qm!);
    panel.replaceChildren(
      h('div', { class: 'situation' }, h('span', { class: 'versus' }, `You v ${opponent}`),
        sit.moment ? h('span', { class: 'moment', id: 'moment' }, sit.moment) : null, h('span', { id: 'situation' }, sit.line)),
      renderRead(opponentRead(qm!)),
      h('div', { class: 'cards' }, cardChoices(qm!).map((c, i) => h('button', { class: `card-btn ${c.card}`, id: `card-${c.card}`, onclick: () => void choose(c.card) },
        h('span', { class: 'key' }, String(i + 1)), h('strong', null, c.label), h('span', { class: 'flavour' }, c.flavour),
        h('span', { class: 'rule' }, `beats ${CARD_LABEL[c.beats]}`),
        h('span', { class: 'strength', title: 'How well this card suits you right now' }, h('span', { class: 'fill', style: `width:${Math.min(100, Math.round(c.strength * 60))}%` }))))));
    phase('choose');
  }

  async function choose(card: Card) {
    if (busy || !qm!.pending) return;
    busy = true;
    const { cards, point } = decide(qm!, card);
    const r = revealView(cards, point);
    const verdict = r.matchup === 'won' ? 'You read it!' : r.matchup === 'lost' ? 'They read you' : 'Same card';
    panel.replaceChildren(h('div', { class: `reveal ${r.matchup}`, id: 'reveal' },
      h('div', { class: 'pair' }, h('span', { class: `chip ${r.yours}` }, `You · ${CARD_LABEL[r.yours]}`), h('span', { class: 'vs' }, 'v'),
        h('span', { class: `chip ${r.theirs}` }, `${CARD_LABEL[r.theirs]} · ${opponent}`)),
      h('strong', { class: 'verdict' }, verdict)));
    phase('reveal');
    await sleep(QUICK_PACE.revealSec * 1000);
    if (broadcast && !disposed) await playClip(point);
    if (disposed) return;
    panel.querySelector('#reveal')?.append(h('p', { class: `outcome ${r.winner}`, id: 'outcome' }, `${r.how} · ${r.winner === 'you' ? 'your point' : 'their point'} · ${scoreLine(qm!)}`));
    phase('outcome');
    await sleep(QUICK_PACE.scoreSec * 1000);
    busy = false;
    if (!disposed) await run();
  }

  async function playClip(point: PointEvent) {
    const timeline = broadcast!.load({ schemaVersion: SCHEMA_VERSION, config: qm!.live.config, events: [...qm!.live.events] }, { keepTime: true });
    const seg = timeline.segments.at(-1)!;
    const clip = clipFor(point);
    phase('clip');
    await broadcast!.playWindow(seg.zero + clip.fromTau, seg.zero + clip.toTau, QUICK_PACE.speed);
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
