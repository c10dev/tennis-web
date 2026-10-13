import { describe, expect, it } from 'vitest';
import { ladderPace } from '../src/quick/balance.ts';
import { readerBot } from '../src/quick/bots.ts';
import { resultStats } from '../src/quick/result-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';

// Guards the result targets of ADR-017 over 10 ladders of 30 matches (the CLI runs 30): `npm run test:quick`.
const T = QUICK_TARGETS.result;

describe('quick-match result balance (ADR-017)', () => {
  const r = resultStats(readerBot, 10, 30, 7);

  it('shows a whole-number rating rise after at least four won matches in five', () => {
    expect(r.visibleWins / r.wins).toBeGreaterThanOrEqual(T.visibleGainOnWin.min);
  });

  it('finds the decisive moment in every match with a decision', () => {
    expect(r.withDecision).toBeGreaterThan(0);
    expect(r.decisiveFound).toBe(r.withDecision);
  });

  it('keeps the ladder climb in range with the rewards', () => {
    const climb = ladderPace(readerBot, 10, 30, 7);
    expect(climb).toBeGreaterThanOrEqual(QUICK_TARGETS.flow.ladderClimb30.min);
    expect(climb).toBeLessThanOrEqual(QUICK_TARGETS.flow.ladderClimb30.max);
  });
});
