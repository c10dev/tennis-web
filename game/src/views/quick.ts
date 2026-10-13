// Quick-match screens as data (ADR-016): the ladder home, the point (situation and cards), the reveal, the result.
import { liveCardStrength, liveStatus, matchup, type Card, type PointCards, type PointEvent, type ScoreState } from '@tennis/engine';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { BEATEN_BY, CARDS } from '../quick/ai.ts';
import { ladderOrder, nextOpponent, pointsToNext, rankOf, type QuickState } from '../quick/ladder.ts';
import { userRole, type QuickMatch } from '../quick/match.ts';
import { QUICK } from '../tuning.ts';
import { RATING_LABEL, STYLE_LABEL, SURFACE_LABEL } from './format.ts';

const name = (s: QuickState, id: string) => s.world.players.find((p) => p.id === id)!.name;

export function quickHomeView(s: QuickState) {
  const order = ladderOrder(s);
  const rank = rankOf(s);
  const above = rank > 1 ? s.points[order[rank - 2]!]! : s.points[USER_ID]!;
  const oppId = nextOpponent(s);
  const opp = s.world.players.find((p) => p.id === oppId)!;
  return {
    name: name(s, USER_ID), rank, points: s.points[USER_ID]!, toNext: pointsToNext(s), progress: rank > 1 ? s.points[USER_ID]! / above : 1,
    matches: s.matchNo,
    opponent: {
      id: oppId, name: opp.name, rank: rankOf(s, oppId), style: STYLE_LABEL[opp.style], level: Math.round(overall(opp) * 10) / 10,
      surface: SURFACE_LABEL[QUICK.surfaces[s.matchNo % QUICK.surfaces.length]!],
    },
    recent: s.history.slice(-5).reverse().map((r) => ({ won: r.won, opponent: name(s, r.opponent), score: r.score, delta: r.pointsDelta })),
  };
}

const CALLS = ['0', '15', '30', '40'];
const pointsLine = (sc: ScoreState) => (sc.tiebreak ? `Tiebreak ${sc.points[0]}-${sc.points[1]}` : `${CALLS[sc.points[0]] ?? '40'}-${CALLS[sc.points[1]] ?? '40'}`);

/** The next point from the user's side (the user is player A). */
export function pointSituation(m: QuickMatch) {
  const st = liveStatus(m.live);
  const role = userRole(m);
  const big = st.nextTags.find((t) => t === 'match_point' || t === 'set_point' || t === 'break_point');
  return {
    role,
    line: `${role === 'serve' ? 'Your serve' : 'Their serve'} · ${pointsLine(st.score)} · Games ${st.score.games[0]}-${st.score.games[1]}`,
    moment: big ? big.replace('_', ' ').toUpperCase() : null,
  };
}

const FLAVOUR: Record<'serve' | 'return', Record<Card, string>> = {
  serve: { attack: 'Big serve', defend: 'Safe serve', counter: 'Bait the return' },
  return: { attack: 'Step in', defend: 'Block it deep', counter: 'Read the serve' },
};
const LABEL: Record<Card, string> = { attack: 'Attack', defend: 'Defend', counter: 'Counter' };

export function cardChoices(m: QuickMatch) {
  const role = userRole(m);
  return CARDS.map((card) => ({
    card, label: LABEL[card], flavour: FLAVOUR[role][card], beats: BEATEN_BY[BEATEN_BY[card]], losesTo: BEATEN_BY[card],
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

export function quickResultView(s: QuickState) {
  const r = s.history.at(-1)!;
  return {
    won: r.won, headline: `${r.won ? 'You won' : 'You lost'} ${r.score}`, opponent: name(s, r.opponent), delta: r.pointsDelta,
    rankBefore: r.rankBefore, rankAfter: r.rankAfter, toNext: pointsToNext(s), points: s.points[USER_ID]!,
    ratings: r.progress.map((p) => ({ key: p.key, label: RATING_LABEL[p.key] ?? p.key, before: p.before, after: p.after, levelUp: Math.floor(p.after) > Math.floor(p.before) })),
  };
}
