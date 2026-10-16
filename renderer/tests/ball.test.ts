import { describe, expect, it } from 'vitest';
import type { PointEvent, Surface } from '@tennis/engine';
import { ballAt, ballSpans } from '../src/playback/ball.ts';
import { BALL, PLAYBACK } from '../src/tuning/index.ts';
import { SAMPLE } from './fixtures.ts';

const points: { p: PointEvent; surface: Surface }[] = SAMPLE.flatMap((r) =>
  r.events.flatMap((e) => (e.type === 'point' ? [{ p: e, surface: r.config.surface }] : [])));
const close = (a: { x: number; y: number; z: number } | null, b: { x: number; y: number; z: number }) => {
  expect(a).not.toBeNull();
  expect(a!.x).toBeCloseTo(b.x, 6);
  expect(a!.y).toBeCloseTo(b.y, 6);
  expect(a!.z).toBeCloseTo(b.z, 6);
};

describe('ballAt', () => {
  it('is at every contact point at its shot time, and on the ground at every bounce', () => {
    for (const { p, surface } of points) {
      for (const s of p.shots) {
        close(ballAt(p, s.t, surface), s.from);
        if (s.bounce) close(ballAt(p, s.t + s.flightSec, surface), { ...s.bounce, z: 0 });
      }
    }
  });

  it('is hidden before the first toss and after the last ball has rolled out', () => {
    for (const { p, surface } of points) {
      expect(ballAt(p, -PLAYBACK.tossLeadSec - 0.01, surface)).toBeNull();
      expect(ballAt(p, -PLAYBACK.tossLeadSec, surface)).not.toBeNull();
      const last = p.shots.at(-1)!;
      expect(ballAt(p, last.t + last.flightSec + BALL.rollSec - 0.01, surface)).not.toBeNull();
      expect(ballAt(p, last.t + last.flightSec + BALL.rollSec + 0.01, surface)).toBeNull();
    }
  });

  it('hides a fault between its roll-out and the toss of the second serve', () => {
    let faults = 0;
    for (const { p, surface } of points) {
      const fault = p.shots.find((s) => s.outcome === 'fault');
      if (!fault) continue;
      faults++;
      const second = p.shots[p.shots.indexOf(fault) + 1]!;
      expect(fault.t + fault.flightSec + BALL.rollSec).toBeLessThan(second.t - PLAYBACK.tossLeadSec);
      expect(ballAt(p, second.t - PLAYBACK.tossLeadSec - 0.05, surface)).toBeNull();
      expect(ballAt(p, second.t - PLAYBACK.tossLeadSec + 0.05, surface)).not.toBeNull();
    }
    expect(faults).toBeGreaterThan(50);
  });

  it('stays on or above the ground and moves without jumps between 60 fps frames', () => {
    let lowest = Infinity;
    let biggestStep = 0;
    for (const { p, surface } of points) {
      let prev = null as ReturnType<typeof ballAt>;
      const endTau = p.durationSec + 0.1;
      for (let tau = -PLAYBACK.tossLeadSec; tau <= endTau; tau += 1 / 60) {
        const b = ballAt(p, tau, surface);
        if (b) lowest = Math.min(lowest, b.z);
        if (b && prev) biggestStep = Math.max(biggestStep, Math.hypot(b.x - prev.x, b.y - prev.y, b.z - prev.z));
        prev = b;
      }
    }
    expect(lowest).toBeGreaterThanOrEqual(-1e-9);
    expect(biggestStep).toBeLessThan(1.2);
  });

  it('drops a net ball at the net on the hitter\'s side and leaves it there', () => {
    let nets = 0;
    for (const { p, surface } of points) {
      for (const s of p.shots.filter((x) => !x.bounce)) {
        nets++;
        const lying = ballAt(p, s.t + s.flightSec + BALL.rollSec - 0.01, surface)!;
        expect(lying.z).toBeCloseTo(0, 6);
        expect(Math.abs(lying.y)).toBeLessThan(0.2);
        expect(Math.sign(lying.y)).toBe(Math.sign(s.from.y));
      }
    }
    expect(nets).toBeGreaterThan(20);
  });

  it('carries a winner on past the bounce, bouncing once more higher on clay than on grass', () => {
    const hop = (surface: Surface) => {
      const found = points.find((x) => x.surface === surface && x.p.endedBy === 'winner')!;
      const last = found.p.shots.at(-1)!;
      let peak = 0;
      for (let k = 1; k < 48; k++) peak = Math.max(peak, ballAt(found.p, last.t + last.flightSec + k / 60, surface)!.z);
      const after = ballAt(found.p, last.t + last.flightSec + 0.3, surface)!;
      const dir = Math.sign(last.bounce!.y - last.from.y);
      expect(Math.sign(after.y - last.bounce!.y)).toBe(dir);
      return peak;
    };
    expect(hop('clay')).toBeGreaterThan(hop('grass'));
  });
});

describe('ballSpans', () => {
  it('lists exactly the stretches of point time when the ball is on screen (TD-057)', () => {
    for (const { p, surface } of points.slice(0, 120)) {
      const spans = ballSpans(p);
      spans.forEach((sp, i) => {
        expect(sp.to).toBeGreaterThan(sp.from);
        if (i > 0) expect(sp.from).toBeGreaterThanOrEqual(spans[i - 1]!.to);
      });
      const last = spans.at(-1)!;
      for (let tau = -PLAYBACK.tossLeadSec - 0.5; tau < last.to + 0.5; tau += 0.01) {
        const inside = spans.some((sp) => tau >= sp.from && tau <= sp.to);
        const near = spans.some((sp) => Math.abs(tau - sp.from) < 1e-6 || Math.abs(tau - sp.to) < 1e-6);
        if (!near) expect(ballAt(p, tau, surface) !== null, `tau ${tau.toFixed(2)}`).toBe(inside);
      }
    }
  });
});
