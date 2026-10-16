import { describe, expect, it } from 'vitest';
import { ladderPace, matchupEdge, median, share, skillLadder, winRate } from '../src/quick/balance.ts';
import { randomBot, readerBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';

// Guards the flow targets of ADR-017 with 600 matches and 10 ladders (the CLI runs 2,000 and 30): `npm run test:quick`.
const T = QUICK_TARGETS.flow;
const N = 600;
const within = (v: number, t: { min: number; max: number }, slack: number) => {
  expect(v).toBeGreaterThanOrEqual(t.min - slack);
  expect(v).toBeLessThanOrEqual(t.max + slack);
};

describe('quick-match flow balance (ADR-017)', () => {
  const random = winRate(randomBot, N, 7);

  it('is one tiebreak of about twelve points, short on screen', () => {
    within(median(random.points), T.medianPoints, 0);
    within(median(random.seconds), T.medianSeconds, 3);
    within(median(random.gameSeconds), T.medianSeconds, 3);
  });

  it('stops for cards three to five times a match, at least twice in nine matches of ten', () => {
    within(median(random.decisions), T.medianDecisions, 0);
    within(share(random.decisions, (d) => d >= 2), T.twoOrMoreDecisions, 0.02);
    within(Math.max(...random.decisions), T.maxDecisions, 0);
  });
  it('makes a won matchup at a decision point worth 20-30 pp', () => within(matchupEdge(N / 2, 7), T.matchupEdge, 0.02));

  it('lets better players win more often', () => {
    const w = skillLadder(200, 7);
    for (let i = 1; i < w.length; i++) expect(w[i]!).toBeGreaterThan(w[i - 1]!);
  });

  it('climbs the ladder at the intended pace', () => within(ladderPace(readerBot, 10, 30, 7), T.ladderClimb30, 3));
});
