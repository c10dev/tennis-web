import { describe, expect, it } from 'vitest';
import { carryover, rankingOrder, rankingPoints } from '../src/ranking.ts';
import { CALENDAR } from '../src/calendar/schedule.ts';
import { RANKING } from '../src/tuning.ts';

describe('ranking', () => {
  it('starts from last season\'s points by level, fading to nothing by the season\'s end', () => {
    expect(carryover(1, 0)).toBe(RANKING.carryoverTop);
    expect(carryover(1, 0)).toBeGreaterThan(carryover(10, 0));
    expect(carryover(10, 0)).toBeGreaterThan(carryover(40, 0));
    expect(carryover(1, CALENDAR.weeks)).toBe(0);
    expect(carryover(1, CALENDAR.weeks / 2)).toBeCloseTo(RANKING.carryoverTop / 2, 0);
  });

  it('adds this season\'s points to the faded carryover', () => {
    expect(rankingPoints({ season: 300, startRank: 5 }, 6)).toBe(300 + carryover(5, 6));
  });

  it('orders by points, then by level, then by id', () => {
    const rows = [
      { id: 'b', points: 100, level: 12 },
      { id: 'a', points: 100, level: 12 },
      { id: 'c', points: 100, level: 13 },
      { id: 'd', points: 400, level: 10 },
    ];
    expect(rankingOrder(rows)).toEqual(['d', 'c', 'a', 'b']);
  });
});
