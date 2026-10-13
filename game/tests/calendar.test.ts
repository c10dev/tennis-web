import { describe, expect, it } from 'vitest';
import { CALENDAR, tournamentInWeek } from '../src/calendar/schedule.ts';
import { pointsFor, TIERS } from '../src/calendar/tiers.ts';

describe('season calendar', () => {
  it('has 24 weeks and 14 tournaments: 2 Majors, 3 Masters, 5 250s and 4 Challengers', () => {
    expect(CALENDAR.weeks).toBe(24);
    expect(CALENDAR.tournaments).toHaveLength(14);
    const count = (tier: string) => CALENDAR.tournaments.filter((t) => t.tier === tier).length;
    expect([count('major'), count('masters'), count('t250'), count('challenger')]).toEqual([2, 3, 5, 4]);
    expect(new Set(CALENDAR.tournaments.map((t) => t.week)).size).toBe(14);
    expect(new Set(CALENDAR.tournaments.map((t) => t.name)).size).toBe(14);
    for (const t of CALENDAR.tournaments) {
      expect(t.week).toBeGreaterThanOrEqual(1);
      expect(t.week).toBeLessThanOrEqual(24);
      expect(tournamentInWeek(t.week)).toBe(t);
    }
    expect(tournamentInWeek(4)).toBeNull();
  });

  it('runs the surfaces hard, then clay, then grass, then hard again', () => {
    const order = [...CALENDAR.tournaments].sort((a, b) => a.week - b.week).map((t) => t.surface);
    const runs = order.filter((s, i) => i === 0 || s !== order[i - 1]);
    expect(runs).toEqual(['hard', 'clay', 'grass', 'hard']);
  });

  it('pays more for every round won, from first-round losers to the champion', () => {
    expect([TIERS.major.draw, TIERS.masters.draw, TIERS.t250.draw, TIERS.challenger.draw]).toEqual([64, 32, 32, 16]);
    for (const tier of Object.values(TIERS)) {
      expect(tier.points).toHaveLength(Math.log2(tier.draw) + 1);
      for (let r = 1; r < tier.points.length; r++) expect(tier.points[r]!).toBeGreaterThan(tier.points[r - 1]!);
    }
    expect(pointsFor('major', 6)).toBe(2000);
    expect(pointsFor('masters', 5)).toBe(1000);
    expect(pointsFor('t250', 5)).toBe(250);
    expect(pointsFor('challenger', 4)).toBe(100);
    expect(TIERS.major.bestOf).toBe(5);
    expect(TIERS.masters.bestOf).toBe(3);
  });
});
