import { describe, expect, it } from 'vitest';
import { applyPoint } from '../src/scoring/match.ts';
import { games, play, start, types } from './scoring-helpers.ts';

describe('games', () => {
  it('starts at love with the chosen server', () => {
    const s = start({}, 'B');
    expect(s.score).toEqual({ sets: [], games: [0, 0], points: [0, 0], tiebreak: false, server: 'B' });
    expect(s.winner).toBeNull();
  });

  it('a love hold ends the game, swaps server and changes ends after game 1', () => {
    const { state, events } = play(start(), 'AAAA');
    expect(state.score.games).toEqual([1, 0]);
    expect(state.score.points).toEqual([0, 0]);
    expect(state.score.server).toBe('B');
    expect(types(events)).toEqual(['game_end', 'changeover']);
    expect(events[0]).toMatchObject({ type: 'game_end', winner: 'A', isBreak: false });
  });

  it('needs two clear points from deuce', () => {
    const deuce = play(start(), 'AAABBB').state;
    const adv = play(deuce, 'A');
    expect(adv.events).toEqual([]);
    const backToDeuce = play(adv.state, 'B');
    expect(backToDeuce.events).toEqual([]);
    const won = play(backToDeuce.state, 'BB');
    expect(won.events[0]).toMatchObject({ type: 'game_end', winner: 'B', isBreak: true });
  });

  it('No-Ad: the point at deuce decides the game', () => {
    const { state, events } = play(start({ noAd: true }), 'AAABBBB');
    expect(state.score.games).toEqual([0, 1]);
    expect(events[0]).toMatchObject({ type: 'game_end', winner: 'B', isBreak: true });
  });

  it('changes ends after odd games only', () => {
    const { events } = games(start(), 'AB');
    expect(types(events)).toEqual(['game_end', 'changeover', 'game_end']);
  });

  it('does not mutate the state it is given', () => {
    const s = start();
    const snapshot = JSON.stringify(s);
    applyPoint(s, 'A');
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('sets', () => {
  it('6-4 wins the set; an even total keeps the ends', () => {
    const { state, events } = games(start(), 'AAAAABBBBA');
    expect(state.score.sets).toEqual([[6, 4]]);
    expect(state.score.games).toEqual([0, 0]);
    expect(types(events.slice(-2))).toEqual(['game_end', 'set_end']);
    expect(events.at(-1)).toMatchObject({ type: 'set_end', winner: 'A' });
  });

  it('6-3 wins the set; an odd total changes ends', () => {
    const { state, events } = games(start(), 'AAAAABBBA');
    expect(state.score.sets).toEqual([[6, 3]]);
    expect(types(events.slice(-3))).toEqual(['game_end', 'set_end', 'changeover']);
  });

  it('5-5 needs 7-5', () => {
    const at65 = games(start(), 'ABABABABABA');
    expect(at65.state.score.games).toEqual([6, 5]);
    const won = games(at65.state, 'A');
    expect(won.state.score.sets).toEqual([[7, 5]]);
  });

  it('the server keeps alternating across sets', () => {
    const { state } = games(start(), 'AAAAAA');
    // A served games 1, 3, 5; B served 2, 4, 6; so A serves the first game of set 2.
    expect(state.score.server).toBe('A');
  });
});

describe('tiebreak', () => {
  const at66 = () => games(start(), 'ABABABABABAB').state;

  it('starts at 6-6 with the next server serving first', () => {
    const s = at66();
    expect(s.score.tiebreak).toBe(true);
    expect(s.score.games).toEqual([6, 6]);
    expect(s.score.server).toBe('A');
    expect(s.tiebreakFirstServer).toBe('A');
  });

  it('serves one point, then two each: A B B A A B B', () => {
    let s = at66();
    const servers: string[] = [];
    for (let i = 0; i < 7; i++) {
      servers.push(s.score.server);
      s = applyPoint(s, i % 2 === 0 ? 'A' : 'B').state;
    }
    expect(servers.join('')).toBe('ABBAABB');
  });

  it('changes ends every six points', () => {
    let s = at66();
    const changeoversAfter: number[] = [];
    for (let n = 1; n <= 12; n++) {
      const r = applyPoint(s, n % 2 === 0 ? 'A' : 'B');
      if (r.events.some((e) => e.type === 'changeover')) changeoversAfter.push(n);
      s = r.state;
    }
    expect(changeoversAfter).toEqual([6, 12]);
  });

  it('a tiebreak won 7-0 is not a break, and the first receiver serves the next set', () => {
    // The last point (the 7th) is served by B, so the winner differs from the last server.
    const { state, events } = play(at66(), 'AAAAAAA');
    expect(events.find((e) => e.type === 'game_end')).toMatchObject({ winner: 'A', isBreak: false });
    expect(state.score.server).toBe('B');
  });

  it('7-5 wins the set 7-6; it is not a break, and the first receiver serves next', () => {
    const { state, events } = play(at66(), 'ABABABABAB' + 'AA');
    expect(state.score.sets).toEqual([[7, 6]]);
    expect(events.find((e) => e.type === 'game_end')).toMatchObject({ winner: 'A', isBreak: false });
    expect(state.score.tiebreak).toBe(false);
    expect(state.score.server).toBe('B');
    // 13 games in the set: odd, so ends change.
    expect(events.at(-1)?.type).toBe('changeover');
  });

  it('needs two clear points: 6-6 goes on to 8-6', () => {
    const at66pts = play(at66(), 'ABABABABABAB').state;
    expect(at66pts.score.points).toEqual([6, 6]);
    const at76 = play(at66pts, 'B').state;
    expect(at76.score.tiebreak).toBe(true);
    const won = play(at76, 'B').state;
    expect(won.score.sets).toEqual([[6, 7]]);
  });
});
