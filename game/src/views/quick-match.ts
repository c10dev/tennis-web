// A quick match's screens as data (ADR-017): the decision point (situation and cards), the reveal.
import { liveCardStrength, liveStatus, matchup, type Card, type PointCards, type PointEvent, type PointTag } from '@tennis/engine';
import { BEATEN_BY, CARDS } from '../quick/ai.ts';
import { userRole, type QuickMatch } from '../quick/match.ts';
import { PLANS } from '../quick/plan.ts';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';

/** The decision point from the user's side (the user is player A). */
export function decisionSituation(m: QuickMatch, t: Messages = en) {
  const st = liveStatus(m.live);
  const role = userRole(m);
  const [a, b] = st.score.points;
  return { role, line: t.situation(role, `${a}-${b}`), moment: momentLabel([a, b], st.nextTags, t) };
}

/** The banner over a decision point; tiebreak points, the user first. */
export function momentLabel([a, b]: readonly [number, number], tags: readonly PointTag[], t: Messages = en): string {
  if (tags.includes('match_point')) return a > b ? t.moment.matchPoint : t.moment.matchPointDown;
  return a === b ? t.moment.all(a) : t.moment.big;
}

/** The running score while points play without cards. */
export const scoreLine = (m: QuickMatch): string => {
  const [a, b] = liveStatus(m.live).score.points;
  return `${a}-${b}`;
};

/** English card names (the web build's screens); other languages read `Messages.card`. */
export const CARD_LABEL: Record<Card, string> = en.card;

export function cardChoices(m: QuickMatch, t: Messages = en) {
  const role = userRole(m);
  return CARDS.map((card) => ({
    card, label: t.card[card], flavour: t.flavour[role][card], beats: BEATEN_BY[BEATEN_BY[card]], losesTo: BEATEN_BY[card],
    strength: Math.round(liveCardStrength(m.live, 'A', card) * 100) / 100,
  }));
}

const how = (p: PointEvent, t: Messages) => (p.endedBy in t.how ? t.how[p.endedBy as keyof Messages['how']] : t.how.other);

export function revealView(cards: PointCards, point: PointEvent, t: Messages = en) {
  const m = matchup(cards.A, cards.B);
  return {
    yours: cards.A, theirs: cards.B, matchup: m > 0 ? 'won' as const : m < 0 ? 'lost' as const : 'even' as const,
    winner: point.winner === 'A' ? 'you' as const : 'them' as const, how: how(point, t),
  };
}

/** The game plans the user picks from before a match: how the points without cards are played. */
export const planChoices = (t: Messages = en) => PLANS.map((plan) => ({ plan, ...t.plan[plan], default: plan === 'balanced' }));

/** The running ticker after point `p` of a match (later points, if already played, are left out). */
export function tickerView(m: QuickMatch, p: PointEvent, t: Messages = en) {
  const upTo = m.live.events.filter((e): e is PointEvent => e.type === 'point' && e.index <= p.index);
  return {
    score: `${p.scoreBefore.points[0] + (p.winner === 'A' ? 1 : 0)}-${p.scoreBefore.points[1] + (p.winner === 'B' ? 1 : 0)}`,
    winner: p.winner === 'A' ? 'you' as const : 'them' as const,
    how: how(p, t),
    plan: t.plan[m.plan].label,
    pips: upTo.map((x) => ({ winner: x.winner === 'A' ? 'you' as const : 'them' as const, decision: !!x.cards })),
  };
}
