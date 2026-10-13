// The ranking table.
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { rankingPoints } from '../ranking.ts';
import { currentRanking, playerById, type SeasonState } from '../season/state.ts';

export function rankingsView(s: SeasonState) {
  return currentRanking(s).map((id, i) => {
    const p = playerById(s, id);
    const rank = i + 1;
    return {
      rank, id, name: p.name, points: rankingPoints(s.standings[id]!, s.week - 1), level: Math.round(overall(p) * 10) / 10, age: p.age,
      isUser: id === USER_ID, change: s.standings[id]!.startRank - rank, injured: p.injuryWeeks > 0,
    };
  });
}
