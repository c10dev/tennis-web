import { describe, expect, it } from 'vitest';
import { STREAK_MILESTONES, winStreak } from '../src/quick/streak.ts';

// P3 option A: a visible win streak, no bonus. Pure counting over the ladder history.
const runs = (s: string) => [...s].map((c) => ({ won: c === 'W' }));

describe('winStreak', () => {
  it('counts the wins in a row at the end of the history, and the longest run ever', () => {
    expect(winStreak(runs(''))).toEqual({ current: 0, best: 0, milestone: null });
    expect(winStreak(runs('L'))).toEqual({ current: 0, best: 0, milestone: null });
    expect(winStreak(runs('WWLWW'))).toEqual({ current: 2, best: 2, milestone: null });
    expect(winStreak(runs('WWWWLW'))).toEqual({ current: 1, best: 4, milestone: null });
  });

  it('marks the match that reached a milestone, only that match', () => {
    expect(STREAK_MILESTONES).toEqual([3, 5, 10]);
    expect(winStreak(runs('LWWW')).milestone).toBe(3);
    expect(winStreak(runs('LWWWW')).milestone).toBeNull();
    expect(winStreak(runs('WWWWW')).milestone).toBe(5);
    expect(winStreak(runs('W'.repeat(10))).milestone).toBe(10);
  });
});
