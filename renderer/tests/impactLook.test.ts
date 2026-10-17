// The impact moment's last touches and the trail by shot (ADR-024, TD-063): a hit-stop shake on the impact camera,
// and with the game look the trail takes the colour of the shot that made it.
import { describe, expect, it } from 'vitest';
import type { ShaderMaterial } from 'three';
import type { ShotType } from '@tennis/engine';
import { impactPose } from '../src/camera/impact.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { trailColour } from '../src/scene/ballMotion.ts';
import { createStage } from '../src/scene/stage.ts';
import { BALL_LOOK, BROADCAST, IMPACT_LOOK } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(3));
const index = tl.segments.findIndex((s) => s.point.endedBy === 'winner');
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('hit-stop shake', () => {
  const base = impactPose(tl, index);
  const H = BROADCAST.impact.hitstopSec;

  it('leaves the camera still outside the hit-stop', () => {
    expect(impactPose(tl, index, { clip: 'slowmo', clipT: 0.03 })).toEqual(base);
    expect(impactPose(tl, index, { clip: 'live', clipT: 0.03 })).toEqual(base);
  });

  it('shakes the whole camera within its amplitude during the hold, settling by its end', () => {
    let most = 0;
    for (let t = 0; t <= H + 1e-9; t += H / 20) {
      const p = impactPose(tl, index, { clip: 'hitstop', clipT: t });
      const d = dist(p.position, base.position);
      expect(d).toBeLessThanOrEqual(IMPACT_LOOK.shake.amp * Math.SQRT2 + 1e-9);
      // The aim moves with the camera: the view shakes, it does not swing.
      expect(dist(p.target, base.target)).toBeCloseTo(d, 9);
      most = Math.max(most, d);
    }
    expect(most).toBeGreaterThan(IMPACT_LOOK.shake.amp * 0.4);
    expect(dist(impactPose(tl, index, { clip: 'hitstop', clipT: H }).position, base.position)).toBeLessThan(1e-9);
  });
});

describe('trail colour by shot', () => {
  it('takes the colour of the last contact’s shot type, white for the ones without a colour and before any contact', () => {
    const point = tl.segments[index]!.point;
    expect(trailColour(point, point.shots[0]!.t - 0.1)).toBe(BALL_LOOK.trail.colour);
    for (const s of point.shots) {
      const want = (BALL_LOOK.trail.byShot as Partial<Record<ShotType, number>>)[s.shot] ?? BALL_LOOK.trail.colour;
      expect(trailColour(point, s.t + 0.01)).toBe(want);
    }
    expect(BALL_LOOK.trail.byShot.serve).not.toBe(BALL_LOOK.trail.colour);
    expect(BALL_LOOK.trail.byShot.slice).not.toBe(BALL_LOOK.trail.byShot.serve);
  });

  it('colours the trail with the game look only; the broadcast look keeps it white', () => {
    const seg = tl.segments[index]!;
    const serve = seg.point.shots[0]!;
    const frame = { ...matchFrameAt(tl, seg.zero + serve.t + 0.1), matchT: seg.zero + serve.t + 0.1, camera: 'chase' as const };
    const colourOf = (look: 'game' | 'broadcast') => {
      const stage = createStage(tl, { look });
      stage.applyFrame(frame);
      return ((stage.scene.getObjectByName('ball-trail') as unknown as { material: ShaderMaterial }).material.uniforms.colour!.value).getHex();
    };
    expect(colourOf('broadcast')).toBe(BALL_LOOK.trail.colour);
    expect(colourOf('game')).toBe(BALL_LOOK.trail.byShot.serve);
  });
});
