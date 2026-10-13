// A quick match (ADR-016): pick a card, see both cards, watch the end of the rally (or just the result in fast
// mode), next point. Keys 1/2/3 pick the cards. The 3D code loads only when it is used.
import { SCHEMA_VERSION, type Card, type PointEvent } from '@tennis/engine';
import { cardChoices, clipFor, finishQuick, matchOver, playPoint, pointSituation, QUICK_PACE, revealView } from '@tennis/game';
import type { Ctx, Screen } from '../career/context.ts';
import { h } from '../lib/h.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LABEL: Record<Card, string> = { attack: 'Attack', defend: 'Defend', counter: 'Counter' };

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
  const phase = (p: string) => Object.assign(document.body.dataset, { quickPhase: p, quickPoints: String(qm.recipe.cards.length) });

  function drawChoose() {
    const sit = pointSituation(qm!);
    panel.replaceChildren(
      h('div', { class: 'situation' }, h('span', { class: 'versus' }, `You v ${opponent}`),
        sit.moment ? h('span', { class: 'moment', id: 'moment' }, sit.moment) : null, h('span', { id: 'situation' }, sit.line)),
      h('div', { class: 'cards' }, cardChoices(qm!).map((c, i) => h('button', { class: `card-btn ${c.card}`, id: `card-${c.card}`, onclick: () => void choose(c.card) },
        h('span', { class: 'key' }, String(i + 1)), h('strong', null, c.label), h('span', { class: 'flavour' }, c.flavour),
        h('span', { class: 'rule' }, `beats ${LABEL[c.beats]}`),
        h('span', { class: 'strength', title: 'How well this card suits you right now' }, h('span', { class: 'fill', style: `width:${Math.min(100, Math.round(c.strength * 60))}%` }))))));
    phase('choose');
  }

  async function choose(card: Card) {
    if (busy || matchOver(qm!)) return;
    busy = true;
    const cards = playPoint(qm!, card);
    const point = qm!.live.events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
    const r = revealView(cards, point);
    const verdict = r.matchup === 'won' ? 'You read it!' : r.matchup === 'lost' ? 'They read you' : 'Same card';
    panel.replaceChildren(h('div', { class: `reveal ${r.matchup}`, id: 'reveal' },
      h('div', { class: 'pair' }, h('span', { class: `chip ${r.yours}` }, `You · ${LABEL[r.yours]}`), h('span', { class: 'vs' }, 'v'),
        h('span', { class: `chip ${r.theirs}` }, `${LABEL[r.theirs]} · ${opponent}`)),
      h('strong', { class: 'verdict' }, verdict)));
    phase('reveal');
    await sleep(QUICK_PACE.revealSec * 1000);
    if (broadcast && !disposed) {
      const timeline = broadcast.load({ schemaVersion: SCHEMA_VERSION, config: qm!.live.config, events: [...qm!.live.events] }, { keepTime: true });
      const seg = timeline.segments.at(-1)!;
      const clip = clipFor(point);
      phase('clip');
      await broadcast.playWindow(seg.zero + clip.fromTau, seg.zero + clip.toTau, QUICK_PACE.speed);
    }
    if (disposed) return;
    panel.querySelector('#reveal')?.append(h('p', { class: `outcome ${r.winner}`, id: 'outcome' }, `${r.how} · ${r.winner === 'you' ? 'your point' : 'their point'}`));
    phase('outcome');
    await sleep(QUICK_PACE.scoreSec * 1000);
    busy = false;
    if (disposed) return;
    if (matchOver(qm!)) {
      const next = finishQuick(ctx.quick!, qm!);
      ctx.quickMatch = null;
      await ctx.setQuick(next, '#/quick/result');
      return;
    }
    drawChoose();
  }

  const onKey = (e: KeyboardEvent) => {
    const card = ({ Digit1: 'attack', Digit2: 'defend', Digit3: 'counter' } as Record<string, Card>)[e.code];
    if (card) void choose(card);
  };
  window.addEventListener('keydown', onKey);
  drawChoose();
  return {
    element, bare: true,
    dispose: () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      broadcast?.dispose();
    },
  };
}
