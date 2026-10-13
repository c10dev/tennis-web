import { describe, expect, it } from 'vitest';
import type { PlayerId, Vec2 } from '@tennis/engine';
import { ballAt } from '../src/playback/ball.ts';
import { positionAt } from '../src/playback/movement.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline, segmentAt, type Timeline } from '../src/playback/timeline.ts';
import { COURT_DRAW, RIG_MOTION } from '../src/tuning/index.ts';
import { SAMPLE, match } from './fixtures.ts';

const IDS: PlayerId[] = ['A', 'B'];
const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const ballFor = (tl: Timeline, t: number) => {
  const seg = tl.segments[segmentAt(tl, t)]!;
  return ballAt(seg.point, t - seg.zero, tl.surface);
};

describe('positionAt', () => {
  it('puts each player exactly where the shot event says at every shot', () => {
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      for (const seg of tl.segments) {
        for (const s of seg.point.shots) {
          expect(dist(positionAt(tl, s.hitter, seg.zero + s.t), s.hitterPos)).toBeLessThan(1e-9);
          expect(dist(positionAt(tl, other(s.hitter), seg.zero + s.t), s.receiverPos)).toBeLessThan(1e-9);
        }
        const first = seg.point.shots[0]!;
        expect(dist(positionAt(tl, first.hitter, seg.start), first.hitterPos)).toBeLessThan(1e-9);
      }
    }
  });

  it('moves without teleporting, and walks round the net post to change ends (TD-010)', () => {
    for (const r of SAMPLE.slice(0, 3)) {
      const tl = buildTimeline(r);
      for (const id of IDS) {
        let prev = positionAt(tl, id, 0);
        let crossings = 0;
        for (let t = 1 / 60; t < tl.totalSec; t += 1 / 60) {
          const p = positionAt(tl, id, t);
          expect(dist(p, prev)).toBeLessThan(RIG_MOTION.maxStepPerFrame);
          if (Math.sign(p.y) !== Math.sign(prev.y)) {
            crossings++;
            expect(Math.abs(p.x)).toBeGreaterThan(COURT_DRAW.doublesHalfWidth + COURT_DRAW.postOutside);
          }
          prev = p;
        }
        // The side a player starts each point on, read from the serve event; every change is one walk across.
        const sides = tl.segments.map((seg) => {
          const serve = seg.point.shots[0]!;
          return Math.sign(serve.hitter === id ? serve.hitterPos.y : serve.receiverPos.y);
        });
        const swaps = sides.filter((side, i) => i > 0 && side !== sides[i - 1]).length;
        expect(swaps).toBeGreaterThan(0);
        expect(crossings).toBe(swaps);
      }
    }
  });

  it('keeps rendered running speeds plausible (TD-006): p99 under 7 m/s, never above 8.5 m/s', () => {
    const speeds: number[] = [];
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      for (const id of IDS) {
        let prev = positionAt(tl, id, 0);
        for (let t = 1 / 30; t < tl.totalSec; t += 1 / 30) {
          const p = positionAt(tl, id, t);
          speeds.push(dist(p, prev) * 30);
          prev = p;
        }
      }
    }
    speeds.sort((a, b) => a - b);
    expect(speeds[Math.floor(0.99 * (speeds.length - 1))]!).toBeLessThan(7);
    expect(speeds.at(-1)!).toBeLessThan(8.5);
  });

  it('walks to the next point\'s starting spot during the pause', () => {
    const tl = buildTimeline(match(5));
    tl.segments.slice(0, -1).forEach((seg, i) => {
      const next = tl.segments[i + 1]!.point.shots[0]!;
      expect(dist(positionAt(tl, next.hitter, seg.next - 1e-9), next.hitterPos)).toBeLessThan(1e-6);
    });
  });
});

describe('playerPose', () => {
  const tl = buildTimeline(match(2, 'clay'));

  it('faces the ball when it is in play, and the net when it is not', () => {
    for (let t = 0; t < 300; t += 0.37) {
      const ball = ballFor(tl, t);
      for (const id of IDS) {
        const pose = playerPose(tl, id, t, ball);
        expect(Math.hypot(pose.facing.x, pose.facing.y)).toBeCloseTo(1, 9);
        if (ball && dist(ball, pose.pos) > 0.5) {
          const d = dist(ball, pose.pos);
          expect(pose.facing.x * (ball.x - pose.pos.x) / d + pose.facing.y * (ball.y - pose.pos.y) / d).toBeCloseTo(1, 6);
        } else if (!ball) {
          expect(pose.facing).toEqual({ x: 0, y: -Math.sign(pose.pos.y) });
        }
      }
    }
  });

  it('swings with the shot recorded: serve or wing, half-way through at contact', () => {
    for (const seg of tl.segments.slice(0, 30)) {
      for (const s of seg.point.shots) {
        const at = (dt: number) => playerPose(tl, s.hitter, seg.zero + s.t + dt, null).swing;
        const kind = s.shot === 'serve' ? 'serve' : s.wing;
        expect(at(0)!.kind).toBe(kind);
        expect(at(0)!.phase).toBeCloseTo(0.5, 9);
        expect(at(-0.1)!.phase).toBeLessThan(0.5);
        expect(at(0.1)!.phase).toBeGreaterThan(0.5);
        expect(at(0.5)).toBeNull();
        expect(playerPose(tl, other(s.hitter), seg.zero + s.t, null).swing).toBeNull();
      }
    }
  });

  it('reacts when the last ball lands: the winner celebrates, the loser hangs their head, both stop by the next point', () => {
    for (const seg of tl.segments.slice(0, 30)) {
      const last = seg.point.shots.at(-1)!;
      const landed = seg.zero + last.t + last.flightSec;
      const { winner } = seg.point;
      expect(playerPose(tl, winner, landed - 0.05, null).reaction).toBe('none');
      expect(playerPose(tl, winner, landed + 0.2, null).reaction).toBe('celebrate');
      expect(playerPose(tl, other(winner), landed + 0.2, null).reaction).toBe('dejected');
      expect(playerPose(tl, winner, seg.next, null).reaction).toBe('none');
    }
  });

  it('reports running speed from the movement', () => {
    const seg = tl.segments.find((s) => s.point.shots.length > 4)!;
    const s = seg.point.shots[2]!;
    const mid = seg.zero + (s.t + seg.point.shots[3]!.t) / 2;
    const pose = playerPose(tl, s.hitter, mid, null);
    expect(pose.speed).toBeGreaterThan(0);
    expect(playerPose(tl, 'A', tl.totalSec, null).speed).toBe(0);
  });
});
