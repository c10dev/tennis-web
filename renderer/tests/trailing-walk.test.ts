// The walk after the last point of a match in progress (ADR-030): the next point is not played yet, so the players
// walk to where it will start (the decision hold's ready spots) instead of freezing and then jumping there.
import { describe, expect, it } from 'vitest';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type PlayerId } from '@tennis/engine';
import { heldPlayers, readyPositions, releasedPlayers } from '../src/playback/hold.ts';
import { playerPose } from '../src/playback/pose.ts';
import { distanceAt, positionAt } from '../src/playback/movement.ts';
import { buildTimeline } from '../src/playback/timeline.ts';

const TIEBREAK = { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } as const;
const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { ...TIEBREAK } });
const events = simulateMatch(config, 2).events;
const pointAt = events.map((e, i) => (e.type === 'point' ? i : -1)).filter((i) => i >= 0);
/** The match so far after each of its first eight points (a change of ends comes after six). */
const sofar = pointAt.slice(0, 8).map((i) => buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, i + 1) }));
const ids: PlayerId[] = ['A', 'B'];
const near = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) < eps;

describe('the walk after the last point of a match in progress', () => {
  it('starts where the point ended and ends on the next point’s ready spot', () => {
    for (const tl of sofar) {
      const seg = tl.segments.at(-1)!;
      const ready = readyPositions(tl);
      for (const id of ids) {
        expect(near(positionAt(tl, id, seg.end), positionAt(tl, id, seg.end - 1e-9), 1e-3)).toBe(true);
        expect(near(positionAt(tl, id, seg.next), ready[id].pos)).toBe(true);
      }
    }
  });

  it('moves without a jump and counts its metres for the stride', () => {
    for (const tl of sofar) {
      const seg = tl.segments.at(-1)!;
      for (const id of ids) {
        const steps = 50;
        let prev = positionAt(tl, id, seg.end);
        for (let k = 1; k <= steps; k++) {
          const p = positionAt(tl, id, seg.end + ((seg.next - seg.end) * k) / steps);
          expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(1.5);
          prev = p;
        }
        const walked = distanceAt(tl, id, seg.next) - distanceAt(tl, id, seg.end);
        const straight = Math.hypot(readyPositions(tl)[id].pos.x - positionAt(tl, id, seg.end).x, readyPositions(tl)[id].pos.y - positionAt(tl, id, seg.end).y);
        expect(walked).toBeGreaterThanOrEqual(straight - 1e-6);
      }
    }
  });

  it('stays put after a finished match', () => {
    const done = buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events });
    const seg = done.segments.at(-1)!;
    for (const id of ids) expect(near(positionAt(done, id, seg.next), positionAt(done, id, seg.end))).toBe(true);
  });
});

describe('leaving the decision hold', () => {
  const tl = sofar[5]!;
  const from = heldPlayers(tl, null, 2);
  const to = { A: playerPose(tl, 'A', 0.3), B: playerPose(tl, 'B', 0.3) };

  it('starts on the held spot and hands over to the timeline’s pose, easing between', () => {
    for (const id of ids) {
      expect(near(releasedPlayers(from, to, 0)[id].pos, from[id].pos)).toBe(true);
      expect(releasedPlayers(from, to, 1)[id]).toEqual(to[id]);
      const mid = releasedPlayers(from, to, 0.5)[id];
      expect(near(mid.pos, { x: (from[id].pos.x + to[id].pos.x) / 2, y: (from[id].pos.y + to[id].pos.y) / 2 })).toBe(true);
      expect(Math.hypot(mid.facing.x, mid.facing.y)).toBeCloseTo(1, 9);
      expect(mid.stroke).toBe(to[id].stroke);
    }
  });
});
