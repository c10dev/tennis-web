import { describe, expect, it } from 'vitest';
import { pointTags } from '../src/scoring/context.ts';
import { games, play, start, types } from './scoring-helpers.ts';

const FAST4 = { bestOf: 1 as const, noAd: true, setFormat: 'fast4' as const };

describe('Fast4 sets (ADR-015)', () => {
  it('goes to the first player to four games, and one set wins a best-of-1 match', () => {
    const { state, events } = games(start(FAST4), 'ABAA' + 'A');
    expect(state.score.sets).toEqual([[4, 1]]);
    expect(state.winner).toBe('A');
    expect(types(events).filter((t) => t === 'set_end')).toHaveLength(1);
  });

  it('plays a tiebreak at three games all, not six', () => {
    const s = games(start(FAST4), 'ABABAB').state;
    expect(s.score.games).toEqual([3, 3]);
    expect(s.score.tiebreak).toBe(true);
    expect(pointTags(s)).toContain('tiebreak');
  });

  it('wins the tiebreak at five points, the point at four all deciding it', () => {
    const tb = games(start(FAST4), 'ABABAB').state;
    const sudden = play(tb, 'ABABABAB');
    expect(sudden.state.score.points).toEqual([4, 4]);
    expect(sudden.state.winner).toBeNull();
    const won = play(sudden.state, 'B');
    expect(won.state.winner).toBe('B');
    expect(won.state.score.sets).toEqual([[3, 4]]);
    expect(play(tb, 'AAAAA').state.score.sets).toEqual([[4, 3]]);
  });

  it('keeps standard sets and tiebreaks for standard matches', () => {
    const s = games(start({ setFormat: 'standard' }), 'ABABAB').state;
    expect(s.score.tiebreak).toBe(false);
    expect(games(start(), 'AAAA').state.score.sets).toEqual([]);
  });

  it('with an advantage final set, plays on past three all until two games clear', () => {
    const s = games(start({ ...FAST4, finalSet: 'advantage' }), 'ABABAB').state;
    expect(s.score.tiebreak).toBe(false);
    const on = games(s, 'AB').state;
    expect(on.score.games).toEqual([4, 4]);
    expect(on.winner).toBeNull();
    expect(games(on, 'AA').state.score.sets).toEqual([[6, 4]]);
  });

  it('changes ends after odd games and every six tiebreak points', () => {
    const { events } = games(start(FAST4), 'A');
    expect(types(events)).toEqual(['game_end', 'changeover']);
    const tb = games(start(FAST4), 'ABABAB').state;
    expect(types(play(tb, 'ABABAB').events)).toEqual(['changeover']);
  });
});
