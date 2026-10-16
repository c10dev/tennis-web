// The stroke planner (ADR-024, slice step 2): effector key poses timed from the shot events, closed-form in time.
import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@tennis/engine';
import { playerPose } from '../src/playback/pose.ts';
import { strokeAt, toLocal } from '../src/playback/stroke.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { STROKE } from '../src/tuning/index.ts';
import { SAMPLE, match } from './fixtures.ts';

const tl = buildTimeline(match(3, 'hard'));

describe('stroke planner', () => {
  it('is idle away from the player’s own shots and fully on at contact', () => {
    let checked = 0;
    for (const seg of tl.segments.slice(0, 40)) {
      for (const s of seg.point.shots) {
        const at = seg.zero + s.t;
        const pose = playerPose(tl, s.hitter, at);
        expect(pose.stroke?.weight).toBeCloseTo(1);
        expect(pose.stroke?.contactWeight).toBeCloseTo(1);
        expect(pose.stroke?.kind).toBe(s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand'));
        checked++;
      }
      // Before the toss nobody strokes.
      for (const id of ['A', 'B'] as PlayerId[]) expect(playerPose(tl, id, seg.start - 0.05).stroke).toBeNull();
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('gives the contact point in the player’s own frame: forward +z, left +x, metres up', () => {
    const pos = { x: 1, y: -11 };
    expect(toLocal({ x: 1, y: -10, z: 1 }, pos, { x: 0, y: 1 })).toEqual(expect.objectContaining({ z: expect.closeTo(1), y: 1 }));
    // Facing the far end from the A side, the player's left is court −x.
    const left = toLocal({ x: 0, y: -11, z: 0.5 }, pos, { x: 0, y: 1 });
    expect(left.x).toBeCloseTo(1);
    expect(left.z).toBeCloseTo(0);
  });

  it('keeps the forward swing whole however little time the incoming ball leaves', () => {
    for (const r of SAMPLE) {
      const t2 = buildTimeline(r);
      for (const seg of t2.segments) {
        seg.point.shots.forEach((s, i) => {
          if (s.shot === 'serve' || i === 0) return;
          const plan = strokeAt(t2, s.hitter, seg.zero + s.t, { x: 0, y: 0 }, { x: 0, y: 1 })!;
          const times = plan.keyTimes;
          for (let k = 1; k < times.length; k++) expect(times[k]!, `${seg.point.index}/${i}`).toBeGreaterThanOrEqual(times[k - 1]!);
          const back = times[times.length - 4]!;
          expect(s.t - back).toBeCloseTo(STROKE.forwardSwingSec);
        });
      }
    }
  });
});
