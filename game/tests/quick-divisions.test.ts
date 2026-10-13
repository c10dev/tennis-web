import { describe, expect, it } from 'vitest';
import { USER_ID } from '../src/player/create.ts';
import { overall } from '../src/player/overall.ts';
import { playMatch } from '../src/quick/balance.ts';
import { readerBot } from '../src/quick/bots.ts';
import { finishQuick, promote, rankOf, type QuickState } from '../src/quick/ladder.ts';
import { startQuick } from '../src/quick/match.ts';
import { streamSeed } from '../src/rng.ts';
import { QUICK_DIVISION } from '../src/tuning.ts';
import { quickHomeView } from '../src/views/quick-home.ts';
import { freshLadder } from './quick-helpers.ts';

// Proposal P5 option A: the ladder is one division; the top 8 after enough matches moves up to a stronger one.
const meanLevel = (s: QuickState) => {
  const ai = s.world.players.filter((p) => p.id !== USER_ID);
  return ai.reduce((a, p) => a + overall(p), 0) / ai.length;
};
const play = (s: QuickState, n: number) => {
  for (let m = 0; m < n; m++) s = finishQuick(s, playMatch(startQuick(s), readerBot, streamSeed(s.seed, 'test-user', s.matchNo)));
  return s;
};

describe('divisions (P5)', () => {
  it('promotes into a stronger world, keeping the player, the history and its names', () => {
    const s = play(freshLadder(4), 3);
    const up = promote(s);
    expect(up.division).toBe(2);
    expect(up.divisionStart).toBe(s.matchNo);
    expect(meanLevel(up) - meanLevel(s)).toBeGreaterThan(QUICK_DIVISION.levelStep * 0.7);
    expect(up.world.players.find((p) => p.id === USER_ID)).toEqual(s.world.players.find((p) => p.id === USER_ID));
    expect(up.world.players.filter((p) => p.id !== USER_ID).every((p) => p.id.startsWith('d2'))).toBe(true);
    expect(up.rivals).toEqual({});
    expect(up.history).toEqual(s.history);
    expect(quickHomeView(up).recent.map((r) => r.opponent)).toEqual(quickHomeView(s).recent.map((r) => r.opponent));
    expect(rankOf(up)).toBeGreaterThan(QUICK_DIVISION.promoteTop);
  });

  it('promotes after a match that ends in the top 8, once the division has had its minimum of matches', () => {
    let s = freshLadder(4);
    let promotedAt = -1;
    for (let m = 0; m < 200 && promotedAt < 0; m++) {
      const before = s;
      s = play(s, 1);
      const r = s.history.at(-1)!;
      if (r.promotedTo) {
        promotedAt = m;
        expect(r.promotedTo).toBe(2);
        expect(r.won).toBe(true);
        expect(r.rankAfter).toBeLessThanOrEqual(QUICK_DIVISION.promoteTop);
        expect(s.matchNo - (before.divisionStart ?? 0)).toBeGreaterThanOrEqual(QUICK_DIVISION.minMatches);
        expect(s.division).toBe(2);
      }
    }
    expect(promotedAt).toBeGreaterThanOrEqual(QUICK_DIVISION.minMatches - 1);
  });

  it('keeps the climb going on long ladders', () => {
    const s = play(freshLadder(4), 300);
    expect(s.division ?? 1).toBeGreaterThan(1);
  });

  it('promotes only after a win, and tells the result screen about the new division', async () => {
    const { quickResultView } = await import('../src/views/quick-result.ts');
    let s = freshLadder(4);
    for (let m = 0; m < 300; m++) {
      s = play(s, 1);
      const r = s.history.at(-1)!;
      if (!r.won) expect(r.promotedTo).toBeUndefined();
      if (r.promotedTo) {
        const v = quickResultView(s);
        expect(v.promotedTo).toBe(r.promotedTo);
        expect(v.division).toBe(r.promotedTo);
        break;
      }
    }
  });
});

