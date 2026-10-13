import { describe, expect, it } from 'vitest';
import { USER_ID } from '../src/player/create.ts';
import { ladderOrder, rankOf, type QuickState } from '../src/quick/ladder.ts';
import { nextGoal } from '../src/quick/standing.ts';
import { freshLadder } from './quick-helpers.ts';

/** The ladder with the user `behind` points below the player just above `rank`, so at `rank` when the gap allows. */
function atRank(rank: number, behind = 1): QuickState {
  const s = freshLadder();
  const others = ladderOrder(s).filter((id) => id !== USER_ID);
  const points = { ...s.points, [USER_ID]: s.points[others[rank - 2]!]! - behind };
  return { ...s, points };
}

describe('nextGoal', () => {
  it('starts at the bottom aiming for the top 50', () => {
    const s = freshLadder();
    expect(rankOf(s)).toBeGreaterThan(50);
    expect(nextGoal(s).label).toBe('Top 50');
    expect(nextGoal(s).winsNeeded).toBeGreaterThanOrEqual(1);
  });

  it('names the next milestone above the current rank', () => {
    expect(rankOf(atRank(40))).toBe(40);
    expect(nextGoal(atRank(40)).label).toBe('Top 32');
    expect(nextGoal(atRank(17)).label).toBe('Top 16');
    expect(nextGoal(atRank(9)).label).toBe('Top 8');
    expect(nextGoal(atRank(5)).label).toBe('#1');
  });

  it('needs one win when one win is enough to pass the player at the milestone', () => {
    const s = atRank(33, 5);
    expect(rankOf(s)).toBe(33);
    expect(nextGoal(s)).toEqual({ label: 'Top 32', winsNeeded: 1 });
  });

  it('needs more wins the further away the goal is', () => {
    const near = nextGoal(atRank(33, 5)).winsNeeded;
    const far = nextGoal(atRank(45)).winsNeeded;
    expect(far).toBeGreaterThan(near);
  });

  it('asks the leader to stay on top', () => {
    const s = freshLadder();
    const top = Math.max(...Object.values(s.points));
    expect(nextGoal({ ...s, points: { ...s.points, [USER_ID]: top + 100 } })).toEqual({ label: 'Stay #1', winsNeeded: 0 });
  });
});
