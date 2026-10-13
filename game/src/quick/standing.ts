// The user's next ladder goal after a match (ADR-017).
import { USER_ID } from '../player/create.ts';
import { QUICK, QUICK_REWARD } from '../tuning.ts';
import { ladderOrder, rankOf, type QuickState } from './ladder.ts';
import type { NextGoal } from './types.ts';

/**
 * The next ladder goal above the user and an honest estimate of the wins it takes: each win pays what beating the
 * opponent `placesAbove` places up pays now, the rest of the ladder standing still.
 */
export function nextGoal(s: QuickState): NextGoal {
  const others = ladderOrder(s).filter((id) => id !== USER_ID).map((id) => s.points[id]!);
  let points = s.points[USER_ID]!;
  const rank = () => 1 + others.filter((p) => p >= points).length;
  const start = rankOf(s);
  const goal = QUICK_REWARD.milestones.find((m) => m < start);
  if (goal === undefined) return { label: 'Stay #1', winsNeeded: 0 };
  let wins = 0;
  while (rank() > goal && wins < QUICK_REWARD.maxWins) {
    const r = rank();
    points += QUICK.win + QUICK.perRankAbove * Math.min(QUICK_REWARD.placesAbove, r - 1);
    wins++;
  }
  return { label: goal === 1 ? '#1' : `Top ${goal}`, winsNeeded: Math.max(1, wins) };
}
