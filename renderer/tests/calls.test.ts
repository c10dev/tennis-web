import { describe, expect, it } from 'vitest';
import type { ScoreState } from '@tennis/engine';
import { scoreCall, type CallContext } from '../src/audio/calls.ts';

const NAMES: [string, string] = ['Flint', 'Rook'];
const after = (o: Partial<ScoreState>): ScoreState => ({ sets: [], games: [0, 0], points: [0, 0], tiebreak: false, server: 'A', ...o });
const ctx = (o: Partial<CallContext> = {}): CallContext => ({ server: 'A', winner: 'A', endsGame: false, gap: 'point', noAd: false, ...o });

describe('scoreCall', () => {
  it('calls the server\'s score first', () => {
    expect(scoreCall(after({ points: [1, 0] }), ctx(), NAMES)).toBe('Fifteen love');
    expect(scoreCall(after({ points: [0, 2] }), ctx({ winner: 'B' }), NAMES)).toBe('Love thirty');
    expect(scoreCall(after({ points: [2, 3], server: 'B' }), ctx({ server: 'B' }), NAMES)).toBe('Forty thirty');
    expect(scoreCall(after({ points: [2, 2] }), ctx(), NAMES)).toBe('Thirty all');
  });

  it('calls deuce, advantage and the No-Ad deciding point', () => {
    expect(scoreCall(after({ points: [3, 3] }), ctx(), NAMES)).toBe('Deuce');
    expect(scoreCall(after({ points: [5, 5] }), ctx(), NAMES)).toBe('Deuce');
    expect(scoreCall(after({ points: [4, 3] }), ctx(), NAMES)).toBe('Advantage Flint');
    expect(scoreCall(after({ points: [4, 5] }), ctx({ winner: 'B' }), NAMES)).toBe('Advantage Rook');
    expect(scoreCall(after({ points: [3, 3] }), ctx({ noAd: true }), NAMES)).toBe('Deciding point');
  });

  it('calls games, sets and the match for the winner', () => {
    expect(scoreCall(after({ games: [3, 2] }), ctx({ endsGame: true }), NAMES)).toBe('Game, Flint');
    expect(scoreCall(after({ sets: [[6, 4]] }), ctx({ endsGame: true, gap: 'set_end' }), NAMES)).toBe('Game and first set, Flint');
    expect(scoreCall(after({ sets: [[6, 4], [3, 6]] }), ctx({ winner: 'B', endsGame: true, gap: 'set_end' }), NAMES)).toBe('Game and second set, Rook');
    expect(scoreCall(after({ sets: [[6, 4], [6, 3]] }), ctx({ endsGame: true, gap: 'match_end' }), NAMES)).toBe('Game, set and match, Flint');
  });

  it('calls tiebreak points as numbers, the leader\'s first', () => {
    expect(scoreCall(after({ tiebreak: true, games: [6, 6], points: [3, 2] }), ctx(), NAMES)).toBe('3-2, Flint');
    expect(scoreCall(after({ tiebreak: true, games: [6, 6], points: [1, 4] }), ctx({ winner: 'B' }), NAMES)).toBe('4-1, Rook');
    expect(scoreCall(after({ tiebreak: true, games: [6, 6], points: [3, 3] }), ctx(), NAMES)).toBe('3 all');
  });
});
