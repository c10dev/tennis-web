// Rankings: this season's points plus last season's, which fade out over the season (ADR-011).
import { CALENDAR } from './calendar/schedule.ts';
import { RANKING } from './tuning.ts';

/** Last season's points still counting in `week` for the player who started the season ranked `startRank`. */
export function carryover(startRank: number, week: number): number {
  const fade = Math.max(0, 1 - week / CALENDAR.weeks);
  return Math.round(RANKING.carryoverTop * Math.exp(-(startRank - 1) / RANKING.carryoverScale) * fade);
}

export const rankingPoints = (p: { season: number; startRank: number }, week: number): number => p.season + carryover(p.startRank, week);

/** Best first: by points, then by level, then by id so the order never depends on input order. */
export function rankingOrder(rows: readonly { id: string; points: number; level: number }[]): string[] {
  return [...rows]
    .sort((a, b) => b.points - a.points || b.level - a.level || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => r.id);
}
