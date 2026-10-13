import { describe, expect, it } from 'vitest';
import { pointTags } from '../src/scoring/context.ts';
import { formatPoints, formatScore } from '../src/scoring/format.ts';
import { applyPoint } from '../src/scoring/match.ts';
import { games, play, start, types } from './scoring-helpers.ts';

const SET_A = 'AAAAAA';
const SET_B = 'BBBBBB';
const TO_66 = 'ABABABABABAB';

describe('match length', () => {
  it('best of 3 ends after two sets with no changeover and refuses more points', () => {
    const { state, events } = games(start(), SET_A + SET_A);
    expect(state.winner).toBe('A');
    expect(state.score.sets).toEqual([[6, 0], [6, 0]]);
    expect(types(events.slice(-2))).toEqual(['game_end', 'set_end']);
    expect(() => applyPoint(state, 'B')).toThrow(/over/);
  });

  it('best of 5 needs three sets', () => {
    const two = games(start({ bestOf: 5 }), SET_A + SET_B + SET_A).state;
    expect(two.winner).toBeNull();
    expect(games(two, SET_B + SET_A).state.winner).toBe('A');
  });
});

describe('final set modes', () => {
  const finalSetAt66 = (finalSet: 'tiebreak7' | 'tiebreak10' | 'advantage') =>
    games(start({ finalSet }), SET_A + SET_B + TO_66).state;

  it('tiebreak7: the final set has a normal 7-point tiebreak', () => {
    const s = finalSetAt66('tiebreak7');
    expect(s.score.tiebreak).toBe(true);
    expect(play(s, 'AAAAAAA').state.winner).toBe('A');
  });

  it('tiebreak10: first to 10 by 2 at 6-6 in the final set', () => {
    const s = finalSetAt66('tiebreak10');
    expect(s.score.tiebreak).toBe(true);
    expect(play(s, 'AAAAAAA').state.winner).toBeNull();
    const at99 = play(s, 'AB'.repeat(9)).state;
    expect(at99.score.points).toEqual([9, 9]);
    expect(play(at99, 'A').state.winner).toBeNull();
    expect(play(at99, 'AA').state.winner).toBe('A');
  });

  it('tiebreak10 does not change the earlier sets', () => {
    const s = games(start({ finalSet: 'tiebreak10' }), TO_66).state;
    expect(play(s, 'AAAAAAA').state.score.sets).toEqual([[7, 6]]);
  });

  it('advantage: no tiebreak in the final set, 8-6 wins', () => {
    const s = finalSetAt66('advantage');
    expect(s.score.tiebreak).toBe(false);
    const at76 = games(s, 'A').state;
    expect(at76.winner).toBeNull();
    const done = games(at76, 'A').state;
    expect(done.winner).toBe('A');
    expect(done.score.sets.at(-1)).toEqual([8, 6]);
  });

  it('advantage: earlier sets still use a tiebreak', () => {
    expect(games(start({ finalSet: 'advantage' }), TO_66).state.score.tiebreak).toBe(true);
  });
});

describe('point tags', () => {
  it('nothing special at the start', () => {
    expect(pointTags(start())).toEqual([]);
  });

  it('break point when the receiver can win the game; not on the server game point', () => {
    expect(pointTags(play(start(), 'BBB').state)).toEqual(['break_point']);
    expect(pointTags(play(start(), 'AAA').state)).toEqual([]);
    expect(pointTags(play(start(), 'AAABBBB').state)).toEqual(['break_point']);
    expect(pointTags(play(start({ noAd: true }), 'AAABBB').state)).toEqual(['break_point']);
  });

  it('set point for either player, together with break point', () => {
    const at54 = games(start(), 'AAAAABBBB').state; // A leads 5-4, B to serve? games played 9 -> B serves
    expect(at54.score.server).toBe('B');
    expect(pointTags(play(at54, 'AAA').state)).toEqual(['break_point', 'set_point']);
    expect(pointTags(play(at54, 'BBB').state)).toEqual([]);
  });

  it('match point and tiebreak', () => {
    const s = games(start(), SET_A + TO_66).state;
    expect(pointTags(s)).toEqual(['tiebreak']);
    expect(pointTags(play(s, 'AAAAAA').state)).toEqual(['set_point', 'match_point', 'tiebreak']);
  });

  it('no tags once the match is over', () => {
    expect(pointTags(games(start(), SET_A + SET_A).state)).toEqual([]);
  });
});

describe('format', () => {
  it('shows tennis points', () => {
    expect(formatPoints(start().score)).toBe('0-0');
    expect(formatPoints(play(start(), 'AAB').state.score)).toBe('30-15');
    expect(formatPoints(play(start(), 'AAABBB').state.score)).toBe('40-40');
    expect(formatPoints(play(start(), 'AAABBBA').state.score)).toBe('AD-40');
    expect(formatPoints(play(start(), 'AAABBBB').state.score)).toBe('40-AD');
  });

  it('shows tiebreak points as numbers and the full score line', () => {
    const s = games(start(), SET_A + TO_66).state;
    expect(formatPoints(play(s, 'AAB').state.score)).toBe('2-1');
    expect(formatScore(play(s, 'AAB').state.score)).toBe('6-0 6-6 2-1');
  });
});
