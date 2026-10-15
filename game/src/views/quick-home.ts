// The quick ladder home as data (ADR-016/017): rank, the gap to the next place, the next opponent, recent matches.
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { ladderOrder, nextOpponent, pointsToNext, rankOf, type QuickState } from '../quick/ladder.ts';
import { QUICK } from '../tuning.ts';
import { en } from '../text/en.ts';
import type { Messages } from '../text/types.ts';

export const playerName = (s: QuickState, id: string) => s.world.players.find((p) => p.id === id)!.name;

export function quickHomeView(s: QuickState, t: Messages = en) {
  const order = ladderOrder(s);
  const rank = rankOf(s);
  const above = rank > 1 ? s.points[order[rank - 2]!]! : s.points[USER_ID]!;
  const oppId = nextOpponent(s);
  const opp = s.world.players.find((p) => p.id === oppId)!;
  return {
    name: playerName(s, USER_ID), rank, points: s.points[USER_ID]!, toNext: pointsToNext(s), progress: rank > 1 ? s.points[USER_ID]! / above : 1,
    matches: s.matchNo,
    opponent: {
      id: oppId, name: opp.name, rank: rankOf(s, oppId), style: t.style[opp.style], level: Math.round(overall(opp) * 10) / 10,
      surface: t.surface[QUICK.surfaces[s.matchNo % QUICK.surfaces.length]!],
    },
    recent: s.history.slice(-5).reverse().map((r) => ({ won: r.won, opponent: playerName(s, r.opponent), score: r.score, delta: r.pointsDelta })),
  };
}
