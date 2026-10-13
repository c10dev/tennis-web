import { describe, expect, it } from 'vitest';
import type { PointEvent, ShotEvent } from '@tennis/engine';
import { lineCall } from '../src/broadcast/hawkeye.ts';
import { SAMPLE } from './fixtures.ts';

const GOOD = new Set(['in', 'winner', 'ace']);
const points = SAMPLE.flatMap((r) => r.events.filter((e): e is PointEvent => e.type === 'point'));

describe('lineCall', () => {
  it('calls every bounce exactly as the engine scored it', () => {
    let calls = 0;
    for (const p of points) {
      for (const s of p.shots.filter((x) => x.bounce)) {
        const call = lineCall(p, s)!;
        expect(call.call).toBe(GOOD.has(s.outcome) ? 'IN' : 'OUT');
        expect(call.marginM > 0 || (call.marginM === 0 && call.call === 'IN') || call.call === 'OUT').toBe(true);
        expect(call.mark).toEqual(s.bounce);
        calls++;
      }
    }
    expect(calls).toBeGreaterThan(3000);
  });

  it('measures the distance to the nearest line of the box or court, positive inside', () => {
    const p = points.find((x) => x.server === 'A' && x.shots[0]!.from.y < 0 && (x.scoreBefore.points[0] + x.scoreBefore.points[1]) % 2 === 0)!;
    // A serves from the near end (y < 0) to the deuce box: B's right, which is x < 0 seen from the far end.
    const serve = (x: number, y: number): ShotEvent => ({ ...p.shots[0]!, bounce: { x, y } });
    expect(lineCall(p, serve(-2, 6.38))!.marginM).toBeCloseTo(0.02, 9);
    expect(lineCall(p, serve(-4.13, 3))!).toMatchObject({ call: 'OUT' });
    expect(lineCall(p, serve(-4.13, 3))!.marginM).toBeCloseTo(-0.015, 9);
    expect(lineCall(p, serve(-0.01, 4))!.marginM).toBeCloseTo(0.01, 9);
  });

  it('returns null for a ball that never bounced', () => {
    const p = points.find((x) => x.shots.some((s) => !s.bounce))!;
    expect(lineCall(p, p.shots.find((s) => !s.bounce)!)).toBeNull();
  });

  it('finds close calls (within 5 cm) at the end of some points', () => {
    const close = points.filter((p) => {
      const c = lineCall(p, p.shots.at(-1)!);
      return c !== null && Math.abs(c.marginM) <= 0.05;
    });
    expect(close.length).toBeGreaterThan(5);
  });
});
