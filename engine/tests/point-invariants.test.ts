import { describe, expect, it } from 'vitest';
import { runtime } from '../src/player/condition.ts';
import { averagePlayer, bigServer } from '../src/player/presets.ts';
import { COURT, inHalf, inServiceBox, rightSign, type Side } from '../src/point/court.ts';
import { simulatePoint, type PointInput, type PointResult } from '../src/point/simulatePoint.ts';
import { createRng } from '../src/rng/mulberry32.ts';
import { GEOMETRY } from '../src/tuning.ts';
import type { PlayerId, Surface, Tactic, Vec2 } from '../src/types.ts';

const TACTIC: Tactic = { aggression: 0.5, netApproach: 0, targetBackhand: false, serveTarget: 'mix' };
const SUCCESS = new Set(['in', 'winner', 'ace']);
const ERRORS = new Set(['unforced_error', 'forced_error', 'double_fault']);

function points(n: number, surface: Surface = 'hard'): { input: PointInput; result: PointResult }[] {
  const rng = createRng(2026);
  const out = [];
  for (let i = 0; i < n; i++) {
    const input: PointInput = {
      server: i % 2 === 0 ? 'A' : 'B',
      players: {
        A: runtime(bigServer('A'), TACTIC, 'A', surface, (i % 7) / 10),
        B: runtime(averagePlayer('B'), { ...TACTIC, aggression: (i % 5) / 4, targetBackhand: i % 3 === 0 }, 'B', surface, 0),
      },
      surface,
      pressure: (i % 4) / 4,
      sideOfA: i % 6 < 3 ? -1 : 1,
      deuceCourt: i % 2 === 0,
    };
    out.push({ input, result: simulatePoint(input, rng) });
  }
  return out;
}

const side = (input: PointInput, p: PlayerId): Side => (p === 'A' ? input.sideOfA : (-input.sideOfA as Side));
const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

describe('simulatePoint invariants', () => {
  const sample = [...points(1500, 'hard'), ...points(500, 'clay'), ...points(500, 'grass')];

  it('ends with a consistent winner, reason and rally length', () => {
    for (const { input, result } of sample) {
      const last = result.shots.at(-1)!;
      const expected = SUCCESS.has(last.outcome) ? last.hitter : other(last.hitter);
      expect(result.winner).toBe(expected);
      expect(result.endedBy).toBe(last.outcome);
      expect(result.rallyLength).toBe(result.shots.filter((s) => SUCCESS.has(s.outcome)).length);
      expect(result.shots[0]!.hitter).toBe(input.server);
      expect(result.serveNumber).toBe(result.shots[0]!.outcome === 'fault' ? 2 : 1);
      expect(result.shots.slice(0, -1).every((s) => s.outcome === 'in' || s.outcome === 'fault')).toBe(true);
    }
  });

  it('alternates hitters once the ball is in play, with time always moving forward', () => {
    for (const { result } of sample) {
      const rally = result.shots.filter((s) => s.outcome !== 'fault');
      for (let i = 1; i < rally.length; i++) expect(rally[i]!.hitter).not.toBe(rally[i - 1]!.hitter);
      for (let i = 1; i < result.shots.length; i++) expect(result.shots[i]!.t).toBeGreaterThan(result.shots[i - 1]!.t);
      expect(result.durationSec).toBeGreaterThan(result.shots.at(-1)!.t);
    }
  });

  it('records each ball flight, so a replay knows when it lands without engine internals (schema v2)', () => {
    for (const { result } of sample) {
      result.shots.forEach((s, i) => {
        expect(s.flightSec).toBeGreaterThan(0);
        expect(s.flightSec).toBeLessThan(3);
        const next = result.shots[i + 1];
        if (!next) expect(s.t + s.flightSec + 0.8).toBeCloseTo(result.durationSec, 9);
        else if (s.outcome === 'fault') expect(next.t).toBeCloseTo(s.t + 4, 9);
        else {
          // Bounce to contact depends on how fast the ball comes off the court (ADR-008).
          expect(next.t - (s.t + s.flightSec)).toBeGreaterThanOrEqual(GEOMETRY.minContactSec - 1e-9);
          expect(next.t - (s.t + s.flightSec)).toBeLessThanOrEqual(GEOMETRY.maxContactSec + 1e-9);
        }
      });
    }
  });

  it('puts bounces where the outcome says: in the box or court when good, outside or into the net when not', () => {
    for (const { input, result } of sample) {
      for (const s of result.shots) {
        const target = -side(input, s.hitter) as Side;
        const good = (b: { x: number; y: number }) =>
          s.shot === 'serve' ? inServiceBox(b, target, input.deuceCourt) : inHalf(b, target);
        if (SUCCESS.has(s.outcome)) {
          expect(s.bounce && good(s.bounce)).toBe(true);
          expect(s.netClearance).toBeGreaterThan(0);
        } else if (s.outcome === 'fault' || ERRORS.has(s.outcome)) {
          if (s.bounce) expect(good(s.bounce)).toBe(false);
          else expect(s.netClearance).toBeLessThan(0);
        } else {
          throw new Error(`unexpected outcome ${s.outcome}`);
        }
      }
    }
  });

  it('places players on their own side and serves from the right half', () => {
    for (const { input, result } of sample) {
      for (const s of result.shots) {
        expect(Math.sign(s.hitterPos.y)).toBe(side(input, s.hitter));
        expect(Math.sign(s.receiverPos.y)).toBe(-side(input, s.hitter));
        expect(Math.sign(s.from.y)).toBe(side(input, s.hitter));
        expect(Math.abs(s.hitterPos.x)).toBeLessThanOrEqual(COURT.halfWidth + GEOMETRY.maxWide);
        if (s.shot === 'serve') {
          const deuceSign = -side(input, s.hitter);
          expect(Math.sign(s.from.x)).toBe(input.deuceCourt ? deuceSign : -deuceSign);
        }
      }
    }
  });

  it('plays the wing on the side the ball came to (right-handers)', () => {
    let checked = 0;
    for (const { input, result } of sample) {
      const rally = result.shots.filter((s) => s.outcome !== 'fault');
      for (let i = 1; i < rally.length; i++) {
        const prev = rally[i - 1]!;
        const lateral = Math.abs(prev.bounce!.x);
        // Wide serves land beyond 2.9 m and T serves inside 1.0 m; ground strokes to a wing land beyond 1.2 m.
        const toWing = prev.shot === 'serve' ? lateral >= 2.9 || lateral <= 1.0 : lateral > 1.2;
        if (!toWing) continue;
        const onRight = Math.sign(prev.bounce!.x) === rightSign(side(input, rally[i]!.hitter));
        const forehand = prev.shot === 'serve' && lateral <= 1.0 ? !onRight : onRight;
        expect(rally[i]!.wing).toBe(forehand ? 'forehand' : 'backhand');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('keeps speeds and spins plausible, wings only on ground strokes', () => {
    for (const { result } of sample) {
      for (const s of result.shots) {
        expect(s.speedKmh).toBeGreaterThanOrEqual(50);
        expect(s.speedKmh).toBeLessThanOrEqual(240);
        expect(s.spinRpm).toBeGreaterThanOrEqual(0);
        expect(s.spinRpm).toBeLessThanOrEqual(4500);
        expect(s.from.z).toBeGreaterThan(0);
        if (s.shot === 'serve') expect(s.wing).toBeUndefined();
        else expect(s.wing === 'forehand' || s.wing === 'backhand').toBe(true);
      }
    }
  });

  it('is reproducible from the seed', () => {
    expect(JSON.stringify(points(200))).toBe(JSON.stringify(points(200)));
  });

  it('lets players run no faster than a tour player between the positions it records (TD-006)', () => {
    let fastest = 0;
    for (const { result } of sample) {
      for (const id of ['A', 'B'] as const) {
        const keys = result.shots.map((s) => ({ t: s.t, pos: s.hitter === id ? s.hitterPos : s.receiverPos }));
        for (let i = 1; i < keys.length; i++) {
          const dt = keys[i]!.t - keys[i - 1]!.t;
          const d = dist(keys[i]!.pos, keys[i - 1]!.pos);
          if (dt > 0) fastest = Math.max(fastest, d / dt);
          else expect(d).toBe(0);
        }
      }
    }
    expect(fastest).toBeLessThanOrEqual(GEOMETRY.maxRunSpeed + 1e-9);
  });

  it('meets the ball beyond its bounce, after it has slowed off the court (TD-011)', () => {
    for (const { result } of sample) {
      result.shots.forEach((s, i) => {
        const next = result.shots[i + 1];
        if (!next || s.outcome !== 'in' || !s.bounce) return;
        const inDir = { x: s.bounce.x - s.from.x, y: s.bounce.y - s.from.y };
        const along = (next.from.x - s.bounce.x) * inDir.x + (next.from.y - s.bounce.y) * inDir.y;
        expect(along).toBeGreaterThan(0);
        const before = dist(s.from, s.bounce) / s.flightSec;
        const after = dist(s.bounce, next.from) / (next.t - s.t - s.flightSec);
        expect(after).toBeLessThan(before);
      });
    }
  });

  it('returns serves from around the baseline', () => {
    for (const { result } of sample) {
      const ret = result.shots.find((s) => s.shot === 'return');
      if (ret) expect(Math.abs(ret.hitterPos.y)).toBeGreaterThan(COURT.halfLength - 1.5);
    }
  });

  it('lands some balls within 5 cm of a line, on both sides of it (for Hawk-Eye)', () => {
    let nearIn = 0;
    let nearOut = 0;
    for (const { result } of sample) {
      for (const s of result.shots) {
        if (!s.bounce) continue;
        const gapX = Math.abs(Math.abs(s.bounce.x) - COURT.halfWidth);
        const depth = s.shot === 'serve' ? COURT.serviceLine : COURT.halfLength;
        const gapY = Math.abs(Math.abs(s.bounce.y) - depth);
        if (Math.min(gapX, gapY) > 0.05) continue;
        if (SUCCESS.has(s.outcome)) nearIn++;
        else nearOut++;
      }
    }
    expect(nearIn).toBeGreaterThan(20);
    expect(nearOut).toBeGreaterThan(20);
  });
});

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
