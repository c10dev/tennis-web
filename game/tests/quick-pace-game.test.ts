import { describe, expect, it } from 'vitest';
import type { PointEvent } from '@tennis/engine';
import { broadcastSeconds, clipFor, clipSpeed, decisive, pointSeconds, showsImpact } from '../src/quick/pace.ts';
import { QUICK_PACE } from '../src/tuning.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

// The game pace (ADR-024, TD-060): everything at 1×, less of each point. A decision point shows its last few shots,
// a point without cards its last shot, each from just before the contact so the swing reads.
const points = [1, 2, 3].flatMap((seed) => playLadderMatch(freshLadder(seed)).m.live.events.filter((e): e is PointEvent => e.type === 'point'));
const G = QUICK_PACE.game;
const startBefore = (p: PointEvent, shot: number) => (shot === 0 ? -QUICK_PACE.tossSec : p.shots[shot]!.t - G.leadSec);

describe('quick-match game pace (ADR-024, TD-060)', () => {
  it('has decision points, points without cards, and rallies long enough to cut', () => {
    expect(points.some((p) => p.cards)).toBe(true);
    expect(points.some((p) => !p.cards)).toBe(true);
    expect(points.some((p) => p.shots.length > G.keyShots)).toBe(true);
  });

  it('plays every point at 1×, and the TV pace as before', () => {
    for (const p of points) {
      expect(clipSpeed(p, 'game')).toBe(1);
      expect(clipSpeed(p, 'tv')).toBe(p.cards ? QUICK_PACE.speed : QUICK_PACE.autoSpeed);
      expect(clipSpeed(p)).toBe(clipSpeed(p, 'tv'));
      expect(clipFor(p)).toEqual(clipFor(p, 'tv'));
    }
  });

  it('shows a decision point from just before its last few contacts (the toss when that reaches the serve) to its end', () => {
    for (const p of points.filter((x) => x.cards)) {
      const c = clipFor(p, 'game');
      const first = Math.max(0, p.shots.length - G.keyShots);
      expect(c.full).toBe(true);
      expect(c.toTau).toBeCloseTo(p.durationSec, 9);
      expect(c.fromTau).toBeCloseTo(Math.max(startBefore(p, first), p.durationSec - QUICK_PACE.keyMaxSec), 9);
    }
  });

  it('shows a point without cards from just before its last contact (the toss for an ace or double fault)', () => {
    for (const p of points.filter((x) => !x.cards)) {
      const c = clipFor(p, 'game');
      expect(c.full).toBe(false);
      expect(c.toTau).toBeCloseTo(p.durationSec, 9);
      expect(c.fromTau).toBeCloseTo(startBefore(p, p.shots.length - 1), 9);
    }
  });

  it('marks the impact moment where the renderer splices it: an ace or winner on a big or decisive point', () => {
    const big = ['break_point', 'set_point', 'match_point'] as const;
    for (const p of points) {
      const expected = (p.endedBy === 'ace' || p.endedBy === 'winner') && (decisive(p) || p.tags.some((t) => (big as readonly string[]).includes(t)));
      expect(showsImpact(p)).toBe(expected);
    }
    expect(points.some(showsImpact)).toBe(true);
  });

  it('adds up a match at the game pace: windows at 1×, the ticker beat or reveal and score, and each impact not right after another', () => {
    let previous = false;
    let expected = 0;
    for (const p of points) {
      const impact: boolean = !previous && showsImpact(p);
      previous = impact;
      const c = clipFor(p, 'game');
      expected += (c.toTau - c.fromTau) + (p.cards ? QUICK_PACE.revealSec + QUICK_PACE.scoreSec : QUICK_PACE.autoSec) + (impact ? G.impactSec : 0);
      expect(pointSeconds(p, 'game', impact)).toBeCloseTo((c.toTau - c.fromTau) + (p.cards ? QUICK_PACE.revealSec + QUICK_PACE.scoreSec : QUICK_PACE.autoSec) + (impact ? G.impactSec : 0), 9);
    }
    expect(broadcastSeconds(points, 'game')).toBeCloseTo(expected, 9);
    expect(broadcastSeconds(points)).toBeCloseTo(broadcastSeconds(points, 'tv'), 9);
  });

  it('keeps a point without cards short and a decision point under its cap', () => {
    for (const p of points) {
      const c = clipFor(p, 'game');
      expect(c.toTau - c.fromTau).toBeLessThanOrEqual(p.cards ? QUICK_PACE.keyMaxSec : QUICK_PACE.tossSec + p.durationSec);
    }
    const auto = points.filter((p) => !p.cards).map((p) => pointSeconds(p, 'game'));
    expect(auto.reduce((a, x) => a + x, 0) / auto.length).toBeLessThan(3.5);
  });
});
