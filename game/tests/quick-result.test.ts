import type { Card, PlayerId } from '@tennis/engine';
import { replayMatch, type PointEvent } from '@tennis/engine';
import { describe, expect, it } from 'vitest';
import { decisiveMoment, highlightOf } from '../src/quick/highlight.ts';
import { ladderOrder } from '../src/quick/ladder.ts';
import { cardReward, displayRating, matchReward } from '../src/quick/rewards.ts';
import { QUICK, QUICK_REWARD, type Rated } from '../src/tuning.ts';
import { USER_ID } from '../src/player/create.ts';
import type { DecisionRecord } from '../src/quick/types.ts';
import { freshLadder, ladderWithDecision, playLadderMatch } from './quick-helpers.ts';

const d = (point: number, score: [number, number], user: Card, ai: Card, winner: PlayerId): DecisionRecord => ({ point, score, user, ai, winner });

describe('decisiveMoment', () => {
  it('is null without decisions', () => {
    expect(decisiveMoment({ won: true, decisions: [] })).toBeNull();
    expect(decisiveMoment({ won: false })).toBeNull();
  });

  it('in a won match picks the last decision the user won, preferring a won matchup', () => {
    const decisions = [d(9, [5, 4], 'counter', 'attack', 'A'), d(10, [6, 4], 'attack', 'counter', 'A'), d(11, [6, 5], 'defend', 'defend', 'B')];
    const m = decisiveMoment({ won: true, decisions })!;
    expect(m).toMatchObject({ point: 9, score: '5-4', user: 'counter', ai: 'attack', won: true });
    expect(m.line).toBe('5-4: your counter beat their attack');
  });

  it('in a won match falls back to the last decision won when no matchup was won', () => {
    const decisions = [d(10, [5, 5], 'attack', 'counter', 'A'), d(11, [6, 5], 'defend', 'defend', 'A'), d(12, [7, 5], 'attack', 'defend', 'B')];
    const m = decisiveMoment({ won: true, decisions })!;
    expect(m.point).toBe(11);
    expect(m.line).toBe('6-5: both went defend, and you won the point');
  });

  it('in a lost match picks the last decision lost, preferring a lost matchup', () => {
    const decisions = [d(10, [5, 5], 'attack', 'counter', 'B'), d(11, [5, 6], 'counter', 'attack', 'B'), d(12, [5, 7], 'defend', 'counter', 'A')];
    const m = decisiveMoment({ won: false, decisions })!;
    expect(m).toMatchObject({ point: 10, score: '5-5', won: false });
    expect(m.line).toBe('5-5: their counter beat your attack');
  });

  it('names a point won against the read, and one lost despite it', () => {
    expect(decisiveMoment({ won: true, decisions: [d(10, [5, 5], 'attack', 'counter', 'A')] })!.line).toBe('5-5: their counter beat your attack, but you won the point');
    expect(decisiveMoment({ won: false, decisions: [d(10, [5, 5], 'counter', 'attack', 'B')] })!.line).toBe('5-5: your counter beat their attack, but they won the point');
    expect(decisiveMoment({ won: false, decisions: [d(10, [5, 5], 'defend', 'defend', 'B')] })!.line).toBe('5-5: both went defend, and they won the point');
  });

  it('always finds one when the user decided, even if every decision went the other way', () => {
    const won = decisiveMoment({ won: true, decisions: [d(10, [5, 5], 'attack', 'defend', 'B'), d(11, [5, 6], 'defend', 'attack', 'B')] })!;
    expect(won.point).toBe(11);
    const lost = decisiveMoment({ won: false, decisions: [d(10, [5, 5], 'attack', 'defend', 'A')] })!;
    expect(lost.point).toBe(10);
  });
});

describe('highlightOf', () => {
  it('uses the decisive moment when there is one', () => {
    const r = playLadderMatch(ladderWithDecision(freshLadder())).next.history.at(-1)!;
    expect(r.decisions!.length).toBeGreaterThan(0);
    expect(highlightOf(r)).toEqual(decisiveMoment(r));
  });

  it('falls back to the final point, named differently, when no card was played', () => {
    const r = { ...playLadderMatch(freshLadder()).next.history[0]!, decisions: [] };
    const h = highlightOf(r);
    const last = replayMatch(r.recipe).events.filter((e): e is PointEvent => e.type === 'point').at(-1)!;
    expect(h).toMatchObject({ point: last.index, score: `${last.scoreBefore.points[0]}-${last.scoreBefore.points[1]}`, user: null, ai: null, won: r.won });
    expect(h.line).toBe(r.won ? 'Your plan carried it' : 'They closed it out');
  });
});

describe('overtakes', () => {
  it('records every player above the user before the match and below after it, by name and old rank', () => {
    let s = freshLadder(5);
    let seen = 0;
    for (let i = 0; i < 12; i++) {
      const { next } = playLadderMatch(s);
      const r = next.history.at(-1)!;
      const [before, after] = [ladderOrder(s), ladderOrder(next)];
      const [ub, ua] = [before.indexOf(USER_ID), after.indexOf(USER_ID)];
      const passed = before.filter((id, k) => k < ub && after.indexOf(id) > ua);
      expect(r.overtakes!.map((o) => o.id).sort()).toEqual([...passed].sort());
      for (const o of r.overtakes!) {
        expect(o.rank).toBe(before.indexOf(o.id) + 1);
        expect(o.name).toBe(next.world.players.find((p) => p.id === o.id)!.name);
      }
      expect(r.overtakes!.map((o) => o.rank)).toEqual([...r.overtakes!.map((o) => o.rank)].sort((a, b) => b - a));
      seen += r.overtakes!.length;
      s = next;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('ratings on the 0-100 scale', () => {
  it('shows a rating with its progress as a whole number, five per rating point', () => {
    expect(displayRating(12)).toBe(60);
    expect(displayRating(12.19)).toBe(60);
    expect(displayRating(12.6)).toBe(63);
    expect(displayRating(12 + 0.008 * 25)).toBe(61);
    expect(displayRating(20)).toBe(100);
  });
});

describe('matchReward', () => {
  const me = () => freshLadder().world.players.find((p) => p.id === USER_ID)!;
  const value = (p: ReturnType<typeof me>, k: Rated) => p.attributes[k] + (p.progress[k] ?? 0);
  const gains = (p: ReturnType<typeof me>, reward: Partial<Record<Rated, number>>) =>
    (Object.entries(reward) as [Rated, number][]).filter(([k, x]) => displayRating(value(p, k) + x) > displayRating(value(p, k)));

  // A loss moves at half the win's pace: at most QUICK_REWARD.lossStep (half a shown point), so a rating that close to
  // its next whole number rises and the others creep on (the M6 follow-up to TD-036).
  const lost = [d(10, [5, 5], 'counter', 'defend', 'B')];
  const atStat = (p: ReturnType<typeof me>, values: Partial<Record<Rated, number>>) => {
    for (const [k, v] of Object.entries(values) as [Rated, number][]) { p.attributes[k] = Math.floor(v); p.progress[k] = v - Math.floor(v); }
    return p;
  };

  it('on a loss, lifts the rating behind the decisive card to its next whole number when it is within half a step', () => {
    const p = atStat(me(), { return: 12.15, decision: 12, agility: 12 });
    const reward = matchReward(p, { won: false, decisions: lost, plan: 'balanced' });
    const base = cardReward(['counter'], false);
    expect(reward.return! - base.return!).toBeLessThanOrEqual(QUICK_REWARD.lossStep + 1e-9);
    expect(gains(p, reward).map(([k]) => k)).toEqual(['return']);
    expect(reward.decision).toBe(base.decision);
  });

  it('on a loss, only moves a rating on by half a step when none is that close', () => {
    const p = atStat(me(), { return: 12, decision: 12, agility: 12 });
    const reward = matchReward(p, { won: false, decisions: lost, plan: 'balanced' });
    const base = cardReward(['counter'], false);
    const extra = (Object.keys(reward) as Rated[]).filter((k) => Math.abs(reward[k]! - (base[k] ?? 0)) > 1e-12);
    expect(extra).toHaveLength(1);
    expect(reward[extra[0]!]! - base[extra[0]!]!).toBeCloseTo(QUICK_REWARD.lossStep, 9);
    expect(gains(p, reward)).toEqual([]);
  });

  it('lifts a rating behind the decisive card to its next whole number on a win', () => {
    const p = me();
    const decisions = [d(10, [5, 5], 'counter', 'attack', 'A'), d(11, [6, 5], 'attack', 'counter', 'B'), d(12, [6, 6], 'defend', 'attack', 'A')];
    const reward = matchReward(p, { won: true, decisions, plan: 'balanced' });
    const base = cardReward(['counter', 'attack', 'defend'], true);
    const extra = (Object.keys(reward) as Rated[]).filter((k) => Math.abs(reward[k]! - (base[k] ?? 0)) > 1e-12);
    expect(extra).toHaveLength(1);
    expect(QUICK.rewardStats.counter).toContain(extra[0]);
    expect(reward[extra[0]!]! - (base[extra[0]!] ?? 0)).toBeLessThanOrEqual(1 / QUICK_REWARD.displayScale + 1e-9);
    expect(gains(p, reward).map(([k]) => k)).toContain(extra[0]);
  });

  it('lifts a rating behind the game plan when the user won without a decision', () => {
    const p = me();
    const reward = matchReward(p, { won: true, decisions: [], plan: 'aggressive' });
    expect(Object.keys(reward)).toHaveLength(1);
    expect(QUICK.rewardStats.attack).toContain(Object.keys(reward)[0]);
    expect(gains(p, reward)).toHaveLength(1);
  });

  it('skips ratings already at the top', () => {
    const p = me();
    for (const k of QUICK.rewardStats.attack) p.attributes[k] = 20;
    expect(matchReward(p, { won: true, decisions: [], plan: 'aggressive' })).toEqual({});
  });
});
