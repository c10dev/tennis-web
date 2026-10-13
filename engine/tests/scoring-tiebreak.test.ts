import { describe, expect, it } from 'vitest';
import { pointTags } from '../src/scoring/context.ts';
import { play, start, types } from './scoring-helpers.ts';

const TB = { bestOf: 1 as const, noAd: true, setFormat: 'tiebreak' as const };

describe('one-tiebreak matches (ADR-017)', () => {
  it('starts in a tiebreak at 0-0, served first by the first server', () => {
    const s = start(TB, 'B');
    expect(s.score.tiebreak).toBe(true);
    expect(s.score.server).toBe('B');
    expect(s.tiebreakFirstServer).toBe('B');
    expect(pointTags(s)).toEqual(['tiebreak']);
  });

  it('goes to seven points, two clear, and the set reads 1-0', () => {
    const won = play(start(TB), 'AAAAAAA');
    expect(won.state.winner).toBe('A');
    expect(won.state.score.sets).toEqual([[1, 0]]);
    expect(types(won.events)).toEqual(['changeover', 'game_end', 'set_end']);
    const long = play(start(TB), 'ABABABABABAB');
    expect(long.state.score.points).toEqual([6, 6]);
    expect(play(long.state, 'A').state.winner).toBeNull();
    expect(play(long.state, 'BB').state.score.sets).toEqual([[0, 1]]);
  });

  it('alternates the serve after the first point, then every two, and changes ends every six points', () => {
    const servers: string[] = [];
    let s = start(TB, 'A');
    for (const ch of 'ABABAB') {
      servers.push(s.score.server);
      s = play(s, ch).state;
    }
    expect(servers.join('')).toBe('ABBAAB');
    expect(types(play(start(TB), 'ABABAB').events)).toEqual(['changeover']);
  });

  it('tags set and match points inside the tiebreak, and no break points', () => {
    const six = play(start(TB), 'AAAAAA').state;
    expect(pointTags(six)).toEqual(['set_point', 'match_point', 'tiebreak']);
    const tags = pointTags(play(start(TB), 'ABAB').state);
    expect(tags).not.toContain('break_point');
  });

  it('plays a ten-point tiebreak with the final-set rule', () => {
    const s = play(start({ ...TB, finalSet: 'tiebreak10' }), 'AAAAAAA').state;
    expect(s.winner).toBeNull();
    expect(play(s, 'AAA').state.winner).toBe('A');
  });

  it('starts every set of a longer match in a tiebreak, served first by the player who received first', () => {
    const one = play(start({ ...TB, bestOf: 3 }, 'A'), 'AAAAAAA').state;
    expect(one.winner).toBeNull();
    expect(one.score.tiebreak).toBe(true);
    expect(one.score.server).toBe('B');
    expect(play(one, 'BBBBBBB' + 'AAAAAAA').state.score.sets).toEqual([[1, 0], [0, 1], [1, 0]]);
  });
});
