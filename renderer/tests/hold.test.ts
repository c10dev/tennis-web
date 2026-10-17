// The decision hold (ADR-024 S2, TD-061): while the cards are up both players stand where the next point starts,
// in a ready stance, and the opponent's body shows the tell.
import { describe, expect, it } from 'vitest';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type Card, type MatchEvent, type PointEvent } from '@tennis/engine';
import { heldPlayers, readyPositions } from '../src/playback/hold.ts';
import { buildTimeline, type Timeline } from '../src/playback/timeline.ts';
import { HOLD_STANCES } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const TIEBREAK = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;
const CARDS: Card[] = ['attack', 'defend', 'counter'];

/** Every match in progress before one of its points (the events up to the one before, and what followed it). */
function prefixes(events: MatchEvent[], config: Parameters<typeof buildTimeline>[0]['config']): { timeline: Timeline; next: PointEvent }[] {
  const out: { timeline: Timeline; next: PointEvent }[] = [];
  events.forEach((e, i) => {
    if (e.type !== 'point' || !events.slice(0, i).some((x) => x.type === 'point')) return;
    out.push({ timeline: buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, i) }), next: e });
  });
  return out;
}

const tiebreaks = [1, 2, 3].flatMap((seed) => {
  const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { ...TIEBREAK } });
  return prefixes(simulateMatch(config, seed).events, config);
});
const exhibition = (() => {
  const m = match(4);
  return prefixes(m.events, m.config).slice(0, 40);
})();
const sample = tiebreaks[5]!.timeline;

describe('ready positions for the next point', () => {
  it('put each player on the end and in the court where the next point really starts, facing the net', () => {
    for (const { timeline, next } of [...tiebreaks, ...exhibition]) {
      const ready = readyPositions(timeline);
      const first = next.shots[0]!;
      for (const id of ['A', 'B'] as const) {
        const real = first.hitter === id ? first.hitterPos : first.receiverPos;
        const r = ready[id];
        expect(Math.sign(r.pos.y)).toBe(Math.sign(real.y));
        expect(Math.sign(r.pos.x)).toBe(Math.sign(real.x));
        expect(Math.hypot(r.pos.x - real.x, r.pos.y - real.y)).toBeLessThan(1.6);
        expect(r.facing).toEqual({ x: 0, y: -Math.sign(r.pos.y) });
      }
    }
  });
});

describe('held players', () => {
  it('stand still in the ready stance, with no swing, reaction or ball-driven motion', () => {
    const held = heldPlayers(sample, null, 1.3);
    const ready = readyPositions(sample);
    for (const id of ['A', 'B'] as const) {
      const p = held[id];
      expect(p.pos).toEqual(ready[id].pos);
      expect(p.speed).toBe(0);
      expect(p.swing).toBeNull();
      expect(p.reaction).toBe('none');
      expect(p.reactionWeight).toBe(0);
      expect(p.stroke?.weight).toBe(1);
      expect(p.stroke?.contactWeight).toBe(0);
      expect(p.stroke?.plant.weight).toBe(1);
      expect(p.t).toBe(1.3);
    }
  });

  it('has a stance for every tell of every card, and shows it on the player the tell is about only', () => {
    for (const card of CARDS) {
      expect(HOLD_STANCES[card]).toHaveLength(4);
      HOLD_STANCES[card].forEach((_, index) => {
        const plain = heldPlayers(sample, null, 0.8);
        const told = heldPlayers(sample, { player: 'B', card, index }, 0.8);
        expect(told.A).toEqual(plain.A);
        expect(told.B).not.toEqual(plain.B);
      });
    }
  });

  it('sets the opponent deeper when they drift back, and inside the baseline when they creep up', () => {
    const depth = (card: Card, index: number) => Math.abs(heldPlayers(sample, { player: 'B', card, index }, 0).B.pos.y);
    const plain = Math.abs(heldPlayers(sample, null, 0).B.pos.y);
    expect(depth('defend', 0)).toBeGreaterThan(plain + 1);
    expect(depth('attack', 1)).toBeLessThan(plain - 0.8);
  });

  it('bends the knees for “settles deep, knees bent” and leans in for “watches your feet”', () => {
    const at = (card: Card, index: number) => heldPlayers(sample, { player: 'B', card, index }, 0).B.stroke!.keys;
    const plain = heldPlayers(sample, null, 0).B.stroke!.keys;
    expect(at('defend', 1).drop).toBeGreaterThan(plain.drop + 0.08);
    expect(at('counter', 1).lean).toBeGreaterThan(plain.lean + 0.15);
    expect(at('counter', 2).hand.z).toBeGreaterThan(plain.hand.z + 0.1);
  });

  it('shuffles side to side within its sway, with the speed and velocity of that motion, as a function of hold time', () => {
    const cue = { player: 'B' as const, card: 'counter' as Card, index: 0 };
    const base = heldPlayers(sample, null, 0).B.pos;
    const amp = HOLD_STANCES.counter[0]!.sway;
    let moved = 0;
    for (let t = 0; t < 3; t += 0.05) {
      const p = heldPlayers(sample, cue, t).B;
      expect(Math.abs(p.pos.x - base.x)).toBeLessThanOrEqual(amp + 1e-9);
      expect(p.pos.y).toBeCloseTo(base.y, 9);
      const later = heldPlayers(sample, cue, t + 1e-4).B;
      const v = (later.pos.x - p.pos.x) / 1e-4;
      expect(p.velocity.x).toBeCloseTo(v, 2);
      expect(p.speed).toBeCloseTo(Math.abs(v), 2);
      expect(later.distance).toBeGreaterThanOrEqual(p.distance);
      moved = Math.max(moved, Math.abs(p.pos.x - base.x));
    }
    expect(moved).toBeGreaterThan(amp * 0.9);
    expect(heldPlayers(sample, cue, 1.7)).toEqual(heldPlayers(sample, cue, 1.7));
  });

  it('bounces on the toes for “bounces on the toes”, and stays down for “settles deep”', () => {
    const hops = (card: Card, index: number) => Array.from({ length: 40 }, (_, i) => heldPlayers(sample, { player: 'B', card, index }, i * 0.05).B.splitStep);
    expect(Math.max(...hops('attack', 0))).toBeGreaterThan(0.3);
    expect(Math.min(...hops('attack', 0))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...hops('defend', 1))).toBe(0);
  });
});
