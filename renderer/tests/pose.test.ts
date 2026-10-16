import { describe, expect, it } from 'vitest';
import type { PlayerId, Vec2 } from '@tennis/engine';
import { ballAt, ballSpans } from '../src/playback/ball.ts';
import { positionAt } from '../src/playback/movement.ts';
import { playerPose } from '../src/playback/pose.ts';
import { buildTimeline, segmentAt, type Timeline } from '../src/playback/timeline.ts';
import { COURT_DRAW, PLAYBACK, RIG_MOTION } from '../src/tuning/index.ts';
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

  /** Whether `id` is within the turn window around one of their own contacts at replay time t. */
  const turning = (id: PlayerId, t: number) => {
    const seg = tl.segments[segmentAt(tl, t)]!;
    return seg.point.shots.some((s) => s.hitter === id && Math.abs(t - seg.zero - s.t) < RIG_MOTION.contactTurnSec);
  };

  const F = RIG_MOTION.facing;
  const angle = (v: Vec2) => Math.atan2(v.y, v.x);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const net = (pos: Vec2): Vec2 => ({ x: 0, y: pos.y < 0 ? 1 : -1 });
  /** What a player at replay time t should settle on, or null while a change is still being eased (TD-057). */
  const settledOn = (id: PlayerId, t: number): 'ball' | 'net' | null => {
    const seg = tl.segments[segmentAt(tl, t)]!;
    const tau = t - seg.zero;
    const next = tl.segments[segmentAt(tl, t) + 1];
    if (turning(id, t) || (next && t >= seg.end - F.settleSec)) return null;
    const spans = ballSpans(seg.point);
    const now = spans.find((sp) => tau >= sp.from && tau <= sp.to);
    if (now) return tau - now.from >= F.settleSec ? 'ball' : null;
    const ended = spans.filter((sp) => sp.to <= tau).at(-1);
    return !ended || tau - ended.to >= F.settleSec ? 'net' : null;
  };

  it('faces the ball once it has been in play a moment, and the net once it has been out (TD-057)', () => {
    let onBall = 0;
    let onNet = 0;
    for (let t = 0; t < 300; t += 0.37) {
      const ball = ballFor(tl, t);
      for (const id of IDS) {
        const pose = playerPose(tl, id, t);
        expect(Math.hypot(pose.facing.x, pose.facing.y)).toBeCloseTo(1, 9);
        const settled = settledOn(id, t);
        if (settled === 'net') {
          expect(pose.facing.x).toBeCloseTo(0, 9);
          expect(pose.facing.y).toBeCloseTo(net(pose.pos).y, 9);
          onNet++;
        } else if (settled === 'ball' && ball) {
          const to = { x: ball.x - pose.pos.x, y: ball.y - pose.pos.y };
          // A ball nearby or behind the player is followed only partly: they look over the shoulder, not round.
          if (Math.hypot(to.x, to.y) < F.nearFull || Math.abs(wrap(angle(to) - angle(net(pose.pos)))) > Math.PI / 2) continue;
          expect(Math.abs(wrap(angle(pose.facing) - angle(to)))).toBeLessThan(1e-6);
          onBall++;
        }
      }
    }
    expect(onBall).toBeGreaterThan(50);
    expect(onNet).toBeGreaterThan(50);
  });

  it('never turns faster than RIG_MOTION.facing.maxTurnPerFrame between 60 fps frames, ends changed included', () => {
    for (const r of SAMPLE.slice(0, 3)) {
      const timeline = buildTimeline(r);
      for (const id of IDS) {
        let prev = playerPose(timeline, id, 0).facing;
        for (let t = 1 / 60; t < timeline.totalSec; t += 1 / 60) {
          const f = playerPose(timeline, id, t).facing;
          expect(Math.abs(wrap(angle(f) - angle(prev))), `${id} at ${t.toFixed(3)} s`).toBeLessThan(F.maxTurnPerFrame);
          prev = f;
        }
      }
    }
  });

  it('turns towards where the shot goes at contact, with the ball on the racket side for a forehand (ADR-023)', () => {
    let sided = 0;
    for (const seg of tl.segments.slice(0, 30)) {
      for (const s of seg.point.shots) {
        const t = seg.zero + s.t;
        const pose = playerPose(tl, s.hitter, t);
        if (s.bounce) {
          const d = dist(s.bounce, s.from);
          expect(pose.facing.x * (s.bounce.x - s.from.x) / d + pose.facing.y * (s.bounce.y - s.from.y) / d).toBeGreaterThan(0.99);
        }
        if (s.shot === 'serve') continue;
        // The player's right in court coordinates is the facing turned a quarter clockwise.
        const right = (s.from.x - pose.pos.x) * pose.facing.y - (s.from.y - pose.pos.y) * pose.facing.x;
        expect(Math.sign(right)).toBe(s.wing === 'backhand' ? -1 : 1);
        sided++;
      }
    }
    expect(sided).toBeGreaterThan(50);
  });

  it('swings with the shot recorded: serve or wing, half-way through at contact', () => {
    for (const seg of tl.segments.slice(0, 30)) {
      for (const s of seg.point.shots) {
        const at = (dt: number) => playerPose(tl, s.hitter, seg.zero + s.t + dt).swing;
        const kind = s.shot === 'serve' ? 'serve' : s.wing;
        expect(at(0)!.kind).toBe(kind);
        expect(at(0)!.phase).toBeCloseTo(0.5, 9);
        expect(at(-0.1)!.contact).toEqual(s.from);
        expect(at(-0.1)!.phase).toBeLessThan(0.5);
        expect(at(0.1)!.phase).toBeGreaterThan(0.5);
        expect(at(0.5)).toBeNull();
        expect(playerPose(tl, other(s.hitter), seg.zero + s.t).swing).toBeNull();
      }
    }
  });

  it('reacts when the last ball lands: the winner celebrates, the loser hangs their head, both stop by the next point', () => {
    for (const seg of tl.segments.slice(0, 30)) {
      const last = seg.point.shots.at(-1)!;
      const landed = seg.zero + last.t + last.flightSec;
      const { winner } = seg.point;
      expect(playerPose(tl, winner, landed - 0.05).reaction).toBe('none');
      expect(playerPose(tl, winner, landed + 0.2).reaction).toBe('celebrate');
      expect(playerPose(tl, other(winner), landed + 0.2).reaction).toBe('dejected');
      expect(playerPose(tl, winner, seg.next).reaction).toBe('none');
    }
  });

  it('eases into and out of a reaction instead of snapping (ADR-023)', () => {
    for (const seg of tl.segments.slice(0, 30)) {
      const last = seg.point.shots.at(-1)!;
      const landed = seg.zero + last.t + last.flightSec;
      const end = Math.min(landed + RIG_MOTION.reactionSec, seg.next);
      const ramp = RIG_MOTION.reactionRampSec;
      const weight = (t: number) => playerPose(tl, seg.point.winner, t).reactionWeight;
      expect(weight(landed + 1e-6)).toBeLessThan(0.01);
      if (end - landed > 2 * ramp) expect(weight(landed + ramp)).toBeCloseTo(1, 9);
      expect(weight(end - 1e-6)).toBeLessThan(0.01);
    }
  });

  it('reports running speed from the movement', () => {
    const seg = tl.segments.find((s) => s.point.shots.length > 4)!;
    const s = seg.point.shots[2]!;
    const mid = seg.zero + (s.t + seg.point.shots[3]!.t) / 2;
    const pose = playerPose(tl, s.hitter, mid);
    expect(pose.speed).toBeGreaterThan(0);
    expect(playerPose(tl, 'A', tl.totalSec).speed).toBe(0);
  });
});

describe('playerPose body language (mannequin rig)', () => {
  const tl = buildTimeline(match(2, 'clay'));
  const seg = tl.segments.find((s) => s.point.shots.filter((x) => x.outcome !== 'fault').length >= 5)!;
  const rally = seg.point.shots.filter((x) => x.outcome !== 'fault');
  const at = (id: PlayerId, tau: number) => playerPose(tl, id, seg.zero + tau);

  it('walks or runs with a gait that grows with speed and stops when standing', () => {
    const still = playerPose(tl, 'A', tl.totalSec);
    expect(still.gait.amount).toBe(0);
    const moving = [...Array(200).keys()].map((k) => at(rally[2]!.hitter, rally[1]!.t + (k / 200) * (rally[2]!.t - rally[1]!.t)));
    const fastest = moving.reduce((a, b) => (b.speed > a.speed ? b : a));
    expect(fastest.gait.amount).toBeGreaterThan(0.3);
    expect(fastest.gait.amount).toBeCloseTo(Math.min(1, fastest.speed / RIG_MOTION.fullRunSpeed), 9);
    expect(at('A', 1).gait.phase).not.toBe(at('A', 1.1).gait.phase);
  });

  it('bends the knees into each groundstroke, most at contact', () => {
    const s = rally[2]!;
    expect(at(s.hitter, s.t).crouch).toBeCloseTo(1, 6);
    expect(at(s.hitter, s.t - RIG_MOTION.crouchSec * 0.5).crouch).toBeCloseTo(0.5, 6);
    expect(at(s.hitter, s.t + RIG_MOTION.crouchSec + 0.05).crouch).toBe(0);
    expect(at(other(s.hitter), s.t).crouch).toBe(0);
  });

  it('split-steps as the opponent strikes', () => {
    const s = rally[2]!;
    expect(at(other(s.hitter), s.t).splitStep).toBeCloseTo(1, 6);
    expect(at(other(s.hitter), s.t + RIG_MOTION.splitStepSec + 0.05).splitStep).toBe(0);
    expect(at(s.hitter, s.t).splitStep).toBe(0);
  });

  it('raises the tossing arm through the serve toss and drops it after contact', () => {
    const serve = seg.point.shots[0]!;
    expect(at(serve.hitter, serve.t - 0.2).toss).toBe(1);
    expect(at(serve.hitter, serve.t - PLAYBACK.tossLeadSec).toss).toBe(0);
    expect(at(serve.hitter, serve.t + 0.5).toss).toBe(0);
    expect(at(other(serve.hitter), serve.t - 0.2).toss).toBe(0);
  });
});
