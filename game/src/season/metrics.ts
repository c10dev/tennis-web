// Season balance measures for the batch report and the slow tests (ADR-011). Targets are design goals, not data.
import { pointsFor } from '../calendar/tiers.ts';
import { CALENDAR } from '../calendar/schedule.ts';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { currentRanking, type SeasonState } from './state.ts';

export const SEASON_TARGETS = {
  /** Spearman correlation of season points with ability at the start. */
  rankingVsLevel: { min: 0.7, max: 1 },
  /** Overall gained in a season by 18–19-year-olds with room to grow, training normally. */
  prospectGrowth: { min: 1.5, max: 3 },
  /** Share of players injured at least once in a season. */
  injuredShare: { min: 0.05, max: 0.15 },
} as const;

export interface SeasonMetrics {
  rankingVsLevel: number;
  prospectGrowth: number;
  prospects: number;
  injuredShare: number;
  bookkeeping: boolean;
  userFinalRank: number;
  userGrowth: number;
}

/** Rank correlation with average ranks for ties. */
export function spearman(x: readonly number[], y: readonly number[]): number {
  const rank = (v: readonly number[]) => {
    const order = v.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
    const r = new Array<number>(v.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j++;
      for (let k = i; k <= j; k++) r[order[k]!.i] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const [rx, ry] = [rank(x), rank(y)];
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const [mx, my] = [mean(rx), mean(ry)];
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < rx.length; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}

export function seasonMetrics(start: SeasonState, end: SeasonState): SeasonMetrics {
  const before = new Map(start.world.players.map((p) => [p.id, p]));
  const ids = end.world.players.map((p) => p.id);
  const rankingVsLevel = spearman(ids.map((id) => overall(before.get(id)!)), ids.map((id) => end.standings[id]!.season));
  const growth = (id: string) => overall(end.world.players.find((p) => p.id === id)!) - overall(before.get(id)!);
  const prospects = start.world.players.filter((p) => p.age <= 19 && p.potential - overall(p) >= 2).map((p) => p.id);
  const bookkeeping = end.history.length === CALENDAR.tournaments.length && end.history.every((h) => h.champion)
    && ids.every((id) => end.standings[id]!.season === end.history.reduce((sum, h) => sum + (id in h.roundsWon ? pointsFor(h.tier, h.roundsWon[id]!) : 0), 0));
  return {
    rankingVsLevel,
    prospectGrowth: prospects.reduce((a, id) => a + growth(id), 0) / Math.max(1, prospects.length),
    prospects: prospects.length,
    injuredShare: ids.filter((id) => (end.injuries[id] ?? 0) > 0).length / ids.length,
    bookkeeping,
    userFinalRank: currentRanking(end).indexOf(USER_ID) + 1,
    userGrowth: growth(USER_ID),
  };
}

export function averageMetrics(all: readonly SeasonMetrics[]): SeasonMetrics {
  const avg = (k: keyof SeasonMetrics) => all.reduce((a, m) => a + Number(m[k]), 0) / all.length;
  return {
    rankingVsLevel: avg('rankingVsLevel'), prospectGrowth: avg('prospectGrowth'), prospects: avg('prospects'), injuredShare: avg('injuredShare'),
    bookkeeping: all.every((m) => m.bookkeeping), userFinalRank: avg('userFinalRank'), userGrowth: avg('userGrowth'),
  };
}
