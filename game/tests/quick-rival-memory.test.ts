import { describe, expect, it } from 'vitest';
import type { Card } from '@tennis/engine';
import { decisionOdds } from '../src/quick/ai.ts';
import { recordRival } from '../src/quick/rivals.ts';
import type { DecisionContext } from '../src/quick/types.ts';
import { rivalLine } from '../src/views/quick-scout.ts';
import { QUICK_PERSONA } from '../src/tuning.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

// Proposal P2 option A: a rival remembers the cards you beat it with and leans toward the card that beats them.
const ctx = (rival: DecisionContext['rival']): Omit<DecisionContext, 'rng'> => ({
  style: 'all_court', persona: { habit: 'repeat_card', tellAccuracy: 0.6 }, role: 'serve', score: [5, 5], tags: ['tiebreak'],
  lastPointWinner: null, decisions: [], rival, fatigue: 0,
});

describe('rival memory (P2)', () => {
  it('records the user\'s big-point cards beside the opponent\'s, keeping the latest few', () => {
    const many = Array<Card>(QUICK_PERSONA.rivalSeen + 3).fill('counter');
    const r = recordRival({}, { opponent: 'p9', won: true, aiCards: ['attack'], userCards: ['defend', ...many] });
    expect(r.p9!.yours).toHaveLength(QUICK_PERSONA.rivalSeen);
    expect(r.p9!.yours).not.toContain('defend');
  });

  it('leans a rematch toward the card that beats what the user kept playing against this opponent', () => {
    const fresh = decisionOdds(ctx(null));
    const remembers = decisionOdds(ctx({ met: 1, wins: 1, losses: 0, seen: [], yours: ['counter', 'counter', 'counter', 'counter'] }));
    // Defend beats Counter: index 1.
    expect(remembers[1]).toBeGreaterThan(fresh[1] + 0.05);
    expect(remembers.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('says so on the rival line', () => {
    expect(rivalLine({ met: 2, wins: 2, losses: 0, seen: ['attack'], yours: ['counter', 'counter', 'counter', 'defend'] })).toMatch(/remembers your counters/);
    expect(rivalLine({ met: 1, wins: 1, losses: 0, seen: ['attack'], yours: ['counter', 'defend', 'attack'] })).not.toMatch(/remembers/);
  });

  it('keeps the user\'s cards in the ladder\'s rival records', () => {
    const { m, next } = playLadderMatch(freshLadder(5));
    expect(next.rivals[m.opponent]!.yours).toEqual(m.decisions.map((d) => d.user).slice(-QUICK_PERSONA.rivalSeen));
  });
});
