import { describe, expect, it } from 'vitest';
import { runtime } from '../src/player/condition.ts';
import { averagePlayer, playerWith } from '../src/player/presets.ts';
import { cardStrength } from '../src/point/cards.ts';
import { simulatePoint, type PointInput } from '../src/point/simulatePoint.ts';
import { createRng } from '../src/rng/mulberry32.ts';
import { DEFAULT_TACTIC } from '../src/match/simulateMatch.ts';
import type { Card, PlayerProfile } from '../src/types.ts';

const CARDS: Card[] = ['attack', 'defend', 'counter'];
const beats = (a: Card, b: Card) => (a === 'attack' && b === 'defend') || (a === 'defend' && b === 'counter') || (a === 'counter' && b === 'attack');

interface Run { serverWins: number; aces: number; doubleFaults: number }

/** Server A against returner B over N points; cards fixed, or drawn by `pick` per point. */
function run(serve: Card | null | ((i: number) => Card), ret: Card | null | ((i: number) => Card), o: { a?: PlayerProfile; fatigueA?: number; seed?: number; n?: number } = {}): Run {
  const N = o.n ?? 5000;
  const rng = createRng(o.seed ?? 77);
  const a = runtime(o.a ?? averagePlayer('A'), DEFAULT_TACTIC, 'A', 'hard', o.fatigueA ?? 0);
  const b = runtime(averagePlayer('B'), DEFAULT_TACTIC, 'B', 'hard');
  const out: Run = { serverWins: 0, aces: 0, doubleFaults: 0 };
  for (let i = 0; i < N; i++) {
    const sc = typeof serve === 'function' ? serve(i) : serve;
    const rc = typeof ret === 'function' ? ret(i) : ret;
    const input: PointInput = { server: 'A', players: { A: a, B: b }, surface: 'hard', pressure: 0, sideOfA: -1, deuceCourt: i % 2 === 0,
      ...(sc && rc ? { cards: { A: sc, B: rc } } : {}) };
    const r = simulatePoint(input, rng);
    if (r.winner === 'A') out.serverWins++;
    if (r.endedBy === 'ace') out.aces++;
    if (r.endedBy === 'double_fault') out.doubleFaults++;
  }
  return { serverWins: out.serverWins / N, aces: out.aces / N, doubleFaults: out.doubleFaults / N };
}

const base = run(null, null).serverWins;
/** A fixed, even-handed scramble of the three cards: the 'random opponent'. */
const pick = (seed: number) => (i: number) => CARDS[(Math.imul(i + seed * 7919, 2654435761) >>> 0) % 3]!;

describe('card matchups (ADR-015)', () => {
  it('moves the point 8 to 17 points of percentage towards whoever wins the matchup', () => {
    for (const s of CARDS) {
      for (const r of CARDS) {
        if (s === r) continue;
        const shift = run(s, r).serverWins - base;
        if (beats(s, r)) {
          expect(shift).toBeGreaterThan(0.08);
          expect(shift).toBeLessThan(0.17);
        } else {
          expect(shift).toBeLessThan(-0.08);
          expect(shift).toBeGreaterThan(-0.17);
        }
      }
    }
  });

  it('is close to neutral when both play the same card', () => {
    for (const c of CARDS) expect(Math.abs(run(c, c).serverWins - base)).toBeLessThan(0.04);
  });

  it('has no card that is better than the others against a random opponent, serving or returning', () => {
    const serving = CARDS.map((c) => run(c, pick(1)).serverWins);
    const returning = CARDS.map((c) => run(pick(2), c).serverWins);
    expect(Math.max(...serving) - Math.min(...serving)).toBeLessThan(0.035);
    expect(Math.max(...returning) - Math.min(...returning)).toBeLessThan(0.035);
  });
});

describe('card trade-offs and modifiers', () => {
  it('serves more aces and more double faults with attack than with defend (against the same card, so no matchup edge)', () => {
    const attack = run('attack', 'attack');
    const defend = run('defend', 'defend');
    expect(attack.aces).toBeGreaterThan(defend.aces * 1.5);
    expect(attack.doubleFaults).toBeGreaterThan(defend.doubleFaults * 1.5);
  });

  // On the logit scale: a strong server already wins most points, which would hide a bigger edge in raw percentages.
  it('makes a card stronger in the hands of a player built for it', () => {
    const lg = (p: number) => Math.log(p / (1 - p));
    const edge = (a: PlayerProfile) => lg(run('attack', 'defend', { a, n: 20000 }).serverWins) - lg(run('defend', 'defend', { a, n: 20000 }).serverWins);
    const hitter = playerWith('Hitter', { servePower: 17, forehand: 17, aggression: 17 }, 'big_server');
    expect(edge(hitter)).toBeGreaterThan(edge(averagePlayer('A')));
    const strength = (p: PlayerProfile, card: Card) => cardStrength(card, runtime(p, DEFAULT_TACTIC, 'A', 'hard'));
    expect(strength(hitter, 'attack')).toBeGreaterThan(1.4);
    expect(strength(averagePlayer('A'), 'attack')).toBeCloseTo(1, 9);
    expect(strength(hitter, 'counter')).toBeCloseTo(1, 9);
  });

  it('weakens attack when tired', () => {
    const edge = (fatigueA: number) => run('attack', 'defend', { fatigueA }).serverWins - run('defend', 'defend', { fatigueA }).serverWins;
    expect(edge(0.8)).toBeLessThan(edge(0));
  });
});
