import { describe, expect, it } from 'vitest';
import { fingerprint, replayMatch, type Card } from '@tennis/engine';
import { createPlayer, defaultAllocation, USER_ID } from '../src/player/create.ts';
import { finishQuick, ladderOrder, newLadder, nextOpponent, pointsToNext, type QuickState } from '../src/quick/ladder.ts';
import { cardReward } from '../src/quick/rewards.ts';
import { matchOver, playPoint, startQuick, userRole } from '../src/quick/match.ts';
import { fromQuickSave, QUICK_VERSION, toQuickSave } from '../src/quick/save.ts';
import { QUICK } from '../src/tuning.ts';

const fresh = (seed = 3) => newLadder(seed, createPlayer({ name: 'Alex Kim', style: 'all_court', allocation: defaultAllocation('all_court') }, seed));
const rank = (s: QuickState, id = USER_ID) => ladderOrder(s).indexOf(id) + 1;

/** Plays the next quick match with a fixed card choice for the user. */
function play(s: QuickState, choose: (i: number, role: 'serve' | 'return') => Card = (i) => (['attack', 'defend', 'counter'] as const)[i % 3]!) {
  const qm = startQuick(s);
  let i = 0;
  while (!matchOver(qm)) playPoint(qm, choose(i++, userRole(qm)));
  return { qm, next: finishQuick(s, qm) };
}

describe('newLadder', () => {
  it('is the same ladder for the same seed, 64 players with the user around 40th', () => {
    const s = fresh();
    expect(fresh()).toEqual(s);
    expect(ladderOrder(s)).toHaveLength(64);
    // Around 40th: where exactly depends on the world's random spread and the style (all-court has no template bonus).
    expect(rank(s)).toBeGreaterThanOrEqual(25);
    expect(rank(s)).toBeLessThanOrEqual(56);
    const order = ladderOrder(s);
    for (let i = 1; i < order.length; i++) expect(s.points[order[i - 1]!]!).toBeGreaterThanOrEqual(s.points[order[i]!]!);
  });
});

describe('nextOpponent', () => {
  it('is one of the three players just above, chosen by the seed, and not the last opponent when there is a choice', () => {
    const s = fresh();
    const r = rank(s);
    const opp = nextOpponent(s);
    const oppRank = rank(s, opp);
    expect(oppRank).toBeLessThan(r);
    expect(oppRank).toBeGreaterThanOrEqual(r - 3);
    expect(nextOpponent(s)).toBe(opp);
    const after = play(s).next;
    if (rank(after) > 3) expect(nextOpponent(after)).not.toBe(after.history.at(-1)!.opponent);
  });
});

describe('a quick match', () => {
  it('is Fast4 with the user as A, asks for a card each point, and records a recipe that replays it exactly', () => {
    const s = fresh();
    const { qm, next } = play(s);
    expect(qm.recipe.config.rules).toMatchObject({ bestOf: 1, setFormat: 'fast4', noAd: true });
    expect(qm.recipe.config.players[0].name).toBe('Alex Kim');
    const record = next.history.at(-1)!;
    const replay = replayMatch(record.recipe);
    expect(replay.winner === 'A').toBe(record.won);
    expect(fingerprint(replay)).toBe(record.fingerprint);
    expect(record.recipe.cards!.length).toBe(replay.events.filter((e) => e.type === 'point').length);
  });

  it('pays a win with points that grow with the opponent\'s rank, and a loss with a small deduction', () => {
    let s = fresh();
    for (let n = 0; n < 6; n++) {
      const before = s;
      const { next } = play(s);
      const rec = next.history.at(-1)!;
      expect(rec.pointsDelta).toBe(rec.won ? QUICK.win + QUICK.perRankAbove * Math.max(0, rec.rankBefore - rec.opponentRank) : -QUICK.loss);
      expect(next.points[USER_ID]).toBe(Math.max(0, before.points[USER_ID]! + rec.pointsDelta));
      expect(rec.rankAfter).toBe(rank(next));
      expect(next.matchNo).toBe(before.matchNo + 1);
      s = next;
    }
  });

  it('keeps the ladder moving: background matches change other players\' points', () => {
    const s = fresh();
    const { next } = play(s);
    const moved = Object.keys(s.points).filter((id) => id !== USER_ID && next.points[id] !== s.points[id]);
    expect(moved.length).toBeGreaterThanOrEqual(QUICK.background);
  });

  it('shows how far the next place is', () => {
    const s = fresh();
    const order = ladderOrder(s);
    const above = order[rank(s) - 2]!;
    expect(pointsToNext(s)).toBe(s.points[above]! - s.points[USER_ID]! + 1);
  });
});

describe('cardReward', () => {
  it('grows the ratings behind the cards played, half again as much for a win', () => {
    const cards: Card[] = ['attack', 'attack', 'counter'];
    const lost = cardReward(cards, false);
    const won = cardReward(cards, true);
    expect(lost.servePower).toBeCloseTo(2 * QUICK.xpPerCard, 9);
    expect(lost.return).toBeCloseTo(QUICK.xpPerCard, 9);
    expect(lost.consistency ?? 0).toBe(0);
    expect(won.servePower).toBeCloseTo(lost.servePower! * QUICK.winXp, 9);
  });

  it('shows up on the player after the match', () => {
    const s = fresh();
    const { next } = play(s, () => 'attack');
    const me = next.world.players.find((p) => p.id === USER_ID)!;
    const before = s.world.players.find((p) => p.id === USER_ID)!;
    const gained = (me.attributes.servePower + (me.progress.servePower ?? 0)) - (before.attributes.servePower + (before.progress.servePower ?? 0));
    expect(gained).toBeGreaterThan(0);
    expect(next.history.at(-1)!.progress.some((p) => p.key === 'servePower')).toBe(true);
  });
});

describe('quick save', () => {
  it('comes back as it was, and refuses other versions', () => {
    const s = play(fresh()).next;
    const file = toQuickSave(s, '2026-10-13 10:00');
    expect(file.quickVersion).toBe(QUICK_VERSION);
    expect(fromQuickSave(JSON.parse(JSON.stringify(file)))).toEqual(s);
    expect(() => fromQuickSave({ ...file, quickVersion: 9 })).toThrow(/version 9/);
    expect(() => fromQuickSave(null)).toThrow(/not a TennisSim quick-match save/);
  });
});
