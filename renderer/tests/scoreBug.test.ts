import { describe, expect, it } from 'vitest';
import type { ScoreState } from '@tennis/engine';
import { scoreBugModel } from '../src/overlay/scoreBug.ts';

const NAMES: [string, string] = ['Flint', 'Rook'];
const score = (o: Partial<ScoreState>): ScoreState => ({ sets: [], games: [0, 0], points: [0, 0], tiebreak: false, server: 'A', ...o });
const points = (s: ScoreState, noAd = false) => scoreBugModel(s, NAMES, { noAd, winner: null }).rows.map((r) => r.points);

describe('scoreBugModel', () => {
  it('calls points 0/15/30/40 for each player', () => {
    expect(points(score({ points: [0, 0] }))).toEqual(['0', '0']);
    expect(points(score({ points: [1, 0] }))).toEqual(['15', '0']);
    expect(points(score({ points: [2, 3] }))).toEqual(['30', '40']);
  });

  it('shows deuce as 40-40 and advantage as AD against 40', () => {
    expect(points(score({ points: [3, 3] }))).toEqual(['40', '40']);
    expect(points(score({ points: [5, 5] }))).toEqual(['40', '40']);
    expect(points(score({ points: [4, 3] }))).toEqual(['AD', '40']);
    expect(points(score({ points: [6, 7] }))).toEqual(['40', 'AD']);
  });

  it('has no advantage under No-Ad: 40-40 is the deciding point', () => {
    expect(points(score({ points: [3, 3] }), true)).toEqual(['40', '40']);
  });

  it('counts tiebreak points as numbers', () => {
    expect(points(score({ tiebreak: true, games: [6, 6], points: [7, 6] }))).toEqual(['7', '6']);
    expect(scoreBugModel(score({ tiebreak: true }), NAMES, { noAd: false, winner: null }).tiebreak).toBe(true);
  });

  it('lists finished sets, current games, names and the server', () => {
    const m = scoreBugModel(score({ sets: [[6, 4], [3, 6]], games: [2, 1], server: 'B' }), NAMES, { noAd: false, winner: null });
    expect(m.rows[0]).toMatchObject({ name: 'Flint', sets: [6, 3], games: 2, serving: false, winner: false });
    expect(m.rows[1]).toMatchObject({ name: 'Rook', sets: [4, 6], games: 1, serving: true, winner: false });
    expect(m.final).toBe(false);
  });

  it('marks the winner at the end and drops games, points and the serve marker', () => {
    const m = scoreBugModel(score({ sets: [[6, 4], [7, 6]] }), NAMES, { noAd: false, winner: 'A' });
    expect(m.final).toBe(true);
    expect(m.rows.map((r) => r.winner)).toEqual([true, false]);
    expect(m.rows.map((r) => r.serving)).toEqual([false, false]);
    expect(m.rows.map((r) => r.points)).toEqual(['', '']);
    expect(m.rows.map((r) => r.games)).toEqual([null, null]);
  });
});
