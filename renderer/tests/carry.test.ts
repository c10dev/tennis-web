// The racket carried between strokes (ADR-031 A2): the KayKit clips carry a weapon high and swap height when idle and
// walk blend (a split step flapped it by 0.70 m a frame), so the arms follow effector keys whenever no stroke owns
// them: relaxed between points, ready while the ball is in play, low at a run; strokes blend from it.
import { describe, expect, it } from 'vitest';
import { carryAt, withCarry } from '../src/playback/carry.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { CARRY, READY_STANCE } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
const seg = tl.segments.find((g) => g.point.shots.length > 4 && g.next - g.end > 2)!;

describe('the carry', () => {
  it('is relaxed while walking back between points and ready while the ball is in play', () => {
    const between = carryAt(tl, seg.end + (seg.next - seg.end) / 2, 0.2);
    expect(between.keys.hand.y).toBeCloseTo(CARRY.relaxed.hand[1], 6);
    expect(between.free).toBe(0);
    const inPlay = carryAt(tl, seg.zero + seg.point.shots[1]!.t, 0);
    expect(inPlay.keys.lean).toBeCloseTo(READY_STANCE.lean, 6);
    expect(inPlay.keys.hand.z).toBeCloseTo(READY_STANCE.hand[2], 6);
    expect(inPlay.free).toBe(1);
  });

  it('carries the racket out to its side at a run, the free arm to its clip', () => {
    const run = carryAt(tl, seg.zero + seg.point.shots[1]!.t, CARRY.runFull + 1);
    expect(run.keys.hand.y).toBeCloseTo(CARRY.run.hand[1], 6);
    expect(run.free).toBe(0);
  });

  it('eases between relaxed and ready, never jumping', () => {
    let prev = carryAt(tl, seg.end, 0).keys.hand;
    for (let t = seg.end; t < seg.next + 1.5; t += 1 / 60) {
      const h = carryAt(tl, t, 0).keys.hand;
      expect(Math.hypot(h.x - prev.x, h.y - prev.y, h.z - prev.z)).toBeLessThan(0.02);
      prev = h;
    }
  });

  it('is on every pose the timeline gives, owning the arms but in a reaction', () => {
    const p = playerPose(tl, 'A', seg.zero + 0.5);
    expect(p.carry.weight).toBeCloseTo(1 - p.reactionWeight, 9);
  });
});

describe('a stroke over the carry', () => {
  const carry = { weight: 1, keys: { pelvis: 0, turn: 0, lean: 0.1, drop: 0.05, hand: { x: 0, y: 0.6, z: 0.4 }, dir: { x: 0, y: 0.6, z: 0.8 }, free: { x: 0.1, y: 0.6, z: 0.5 } }, free: 0 };
  const shot = seg.point.shots.find((s) => s.hitter === 'A' && s.shot !== 'serve')!;
  const stroke = playerPose(tl, 'A', seg.zero + shot.t).stroke!;

  it('is the carry alone when no stroke is on', () => {
    const s = withCarry(null, carry)!;
    expect(s.weight).toBe(1);
    expect(s.keys).toEqual(carry.keys);
    expect(s.plant.weight).toBe(0);
    expect(s.hop).toBe(0);
    expect(s.contactWeight).toBe(0);
    expect(s.freeWeight).toBe(0);
    expect(withCarry(null, { ...carry, weight: 0 })).toBeNull();
  });

  it('is the stroke itself at full weight', () => {
    const s = withCarry(stroke, carry)!;
    expect(s.keys).toEqual(stroke.keys);
    expect(s.weight).toBe(1);
    expect(s.hop).toBe(stroke.hop);
    expect(s.freeWeight).toBe(1);
  });

  it('blends the keys from the carry and keeps the stroke’s own share of the body', () => {
    const half = { ...stroke, weight: 0.5 };
    const s = withCarry(half, carry)!;
    expect(s.weight).toBeCloseTo(1, 9);
    expect(s.keys.hand.y).toBeCloseTo((carry.keys.hand.y + stroke.keys.hand.y) / 2, 9);
    // The solver turns the pelvis by keys × weight: the stroke's half plus the carry's (zero) pelvis.
    expect(s.keys.pelvis * s.weight).toBeCloseTo(stroke.keys.pelvis * 0.5, 9);
    expect(s.hop * s.weight).toBeCloseTo(stroke.hop * 0.5, 9);
    expect(s.freeWeight).toBeCloseTo(0.5, 9);
  });
});
