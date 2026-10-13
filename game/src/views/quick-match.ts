// A quick match's screens as data (ADR-017): the decision point (situation and cards), the reveal.
import { liveCardStrength, liveStatus, matchup, type Card, type PointCards, type PointEvent, type PointTag } from '@tennis/engine';
import { BEATEN_BY, CARDS } from '../quick/ai.ts';
import { userRole, type QuickMatch } from '../quick/match.ts';

/** The decision point from the user's side (the user is player A). */
export function decisionSituation(m: QuickMatch) {
  const st = liveStatus(m.live);
  const role = userRole(m);
  const [a, b] = st.score.points;
  return { role, line: `${role === 'serve' ? 'Your serve' : 'Their serve'} · ${a}-${b}`, moment: momentLabel([a, b], st.nextTags) };
}

/** The banner over a decision point; tiebreak points, the user first. */
export function momentLabel([a, b]: readonly [number, number], tags: readonly PointTag[]): string {
  if (tags.includes('match_point')) return a > b ? 'MATCH POINT' : 'MATCH POINT DOWN';
  return a === b ? `${a}-ALL` : 'BIG POINT';
}

/** The running score while points play without cards. */
export const scoreLine = (m: QuickMatch): string => {
  const [a, b] = liveStatus(m.live).score.points;
  return `${a}-${b}`;
};

const FLAVOUR: Record<'serve' | 'return', Record<Card, string>> = {
  serve: { attack: 'Big serve', defend: 'Safe serve', counter: 'Bait the return' },
  return: { attack: 'Step in', defend: 'Block it deep', counter: 'Read the serve' },
};
export const CARD_LABEL: Record<Card, string> = { attack: 'Attack', defend: 'Defend', counter: 'Counter' };

export function cardChoices(m: QuickMatch) {
  const role = userRole(m);
  return CARDS.map((card) => ({
    card, label: CARD_LABEL[card], flavour: FLAVOUR[role][card], beats: BEATEN_BY[BEATEN_BY[card]], losesTo: BEATEN_BY[card],
    strength: Math.round(liveCardStrength(m.live, 'A', card) * 100) / 100,
  }));
}

const HOW: Record<string, string> = { ace: 'Ace', double_fault: 'Double fault', winner: 'Winner', unforced_error: 'Unforced error', forced_error: 'Forced error' };

export function revealView(cards: PointCards, point: PointEvent) {
  const m = matchup(cards.A, cards.B);
  return {
    yours: cards.A, theirs: cards.B, matchup: m > 0 ? 'won' as const : m < 0 ? 'lost' as const : 'even' as const,
    winner: point.winner === 'A' ? 'you' as const : 'them' as const, how: HOW[point.endedBy] ?? 'Error',
  };
}
