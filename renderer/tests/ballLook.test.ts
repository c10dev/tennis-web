import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial, PerspectiveCamera, Vector3, type Mesh } from 'three';
import { COURT } from '@tennis/engine';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme, programmeTimeFor } from '../src/broadcast/programme.ts';
import { mainCamPose } from '../src/camera/mainCam.ts';
import { ballAt } from '../src/playback/ball.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { ballPop, lastContact, trailPoints, trailStyle } from '../src/scene/ballMotion.ts';
import { createStage } from '../src/scene/stage.ts';
import { BALL_LOOK, COLOURS } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2));
/** A point with a rally, and a moment mid-flight of its second shot. */
const seg = tl.segments.find((s) => s.point.shots.length >= 4)!;
const shot = seg.point.shots[1]!;
const midFlight = shot.t + shot.flightSec / 2;

describe('ball size', () => {
  /** Diameter in pixels of a ball at court point (x, y) on a 1280×720 view from the main camera. */
  const pixels = (y: number) => {
    const pose = mainCamPose(0);
    const cam = new PerspectiveCamera(pose.fov, 1280 / 720, 0.3, 400);
    cam.position.set(pose.position.x, pose.position.y, pose.position.z);
    cam.lookAt(pose.target.x, pose.target.y, pose.target.z);
    cam.updateMatrixWorld();
    const centre = new Vector3(0, BALL_LOOK.radius, -y);
    const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(BALL_LOOK.radius);
    const a = centre.clone().sub(right).project(cam);
    const b = centre.clone().add(right).project(cam);
    return (Math.abs(b.x - a.x) / 2) * 1280;
  };

  it('is at least 6 px across at the far baseline from the main camera, and not a beach ball at the near one', () => {
    expect(pixels(COURT.halfLength)).toBeGreaterThanOrEqual(6);
    expect(pixels(-COURT.halfLength)).toBeLessThan(20);
  });

  it('is drawn unlit in optic yellow, untouched by tone mapping and fog', () => {
    const ball = createStage(tl).scene.getObjectByName('ball') as Mesh;
    const m = ball.material as MeshBasicMaterial;
    expect(m).toBeInstanceOf(MeshBasicMaterial);
    expect(m.color.getHex()).toBe(COLOURS.ball);
    expect(m.toneMapped).toBe(false);
    expect(m.fog).toBe(false);
  });

  it('shrinks on the close-up cameras', () => {
    const stage = createStage(tl);
    const frame = matchFrameAt(tl, seg.zero + midFlight);
    const ball = stage.scene.getObjectByName('ball')!;
    stage.applyFrame({ ...frame, camera: 'main' });
    const wide = ball.scale.x;
    stage.applyFrame({ ...frame, camera: 'serve' });
    expect(ball.scale.x).toBeLessThan(wide);
    expect(ball.position.y).toBeCloseTo(frame.ball!.z + BALL_LOOK.radius * ball.scale.x, 9);
  });
});

describe('contact pop', () => {
  it('finds the last contact at or before a moment', () => {
    expect(lastContact(seg.point, midFlight)).toBe(shot.t);
    expect(lastContact(seg.point, -0.5)).toBeNull();
  });

  it('pops the ball up to 1.3× at contact and settles back within the pop time', () => {
    expect(ballPop(0)).toBeCloseTo(BALL_LOOK.pop.scale, 9);
    expect(BALL_LOOK.pop.scale).toBeGreaterThanOrEqual(1.2);
    expect(ballPop(BALL_LOOK.pop.sec / 2)).toBeLessThan(BALL_LOOK.pop.scale);
    expect(ballPop(BALL_LOOK.pop.sec / 2)).toBeGreaterThan(1);
    expect(ballPop(BALL_LOOK.pop.sec)).toBe(1);
    expect(ballPop(null)).toBe(1);
  });

  it('shows the pop on the stage at contact only', () => {
    const stage = createStage(tl);
    const ball = stage.scene.getObjectByName('ball')!;
    stage.applyFrame({ ...matchFrameAt(tl, seg.zero + shot.t + 1e-6), camera: 'main' });
    expect(ball.scale.x).toBeCloseTo(BALL_LOOK.pop.scale, 3);
    stage.applyFrame({ ...matchFrameAt(tl, seg.zero + midFlight), camera: 'main' });
    expect(ball.scale.x).toBe(1);
  });
});

describe('trail', () => {
  it('lasts 0.15–0.25 s', () => {
    expect(BALL_LOOK.trail.sec).toBeGreaterThanOrEqual(0.15);
    expect(BALL_LOOK.trail.sec).toBeLessThanOrEqual(0.25);
  });

  it('follows the ball back along its flight, newest first, no older than the trail time', () => {
    const pts = trailPoints(seg.point, midFlight, tl.surface);
    expect(pts.length).toBeGreaterThan(3);
    expect(pts[0]!.age).toBe(0);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.age).toBeGreaterThan(pts[i - 1]!.age);
    expect(pts.at(-1)!.age).toBeLessThanOrEqual(BALL_LOOK.trail.sec + 1e-9);
    for (const p of pts) expect(p.pos).toEqual(ballAt(seg.point, midFlight - p.age, tl.surface));
  });

  it('starts afresh at each contact, and is empty before the serve and between points', () => {
    const just = trailPoints(seg.point, shot.t + 0.03, tl.surface);
    expect(just.at(-1)!.age).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(trailPoints(seg.point, -0.3, tl.surface)).toEqual([]);
    expect(trailPoints(seg.point, seg.point.durationSec + 5, tl.surface)).toEqual([]);
  });

  it('reaches back half as far in a slow-motion replay, so it covers the same screen time', () => {
    const live = trailPoints(seg.point, midFlight, tl.surface);
    const slow = trailPoints(seg.point, midFlight, tl.surface, BALL_LOOK.trail.sec * BALL_LOOK.trail.replayShare);
    expect(BALL_LOOK.trail.replayShare).toBe(0.5);
    expect(slow.at(-1)!.age).toBeCloseTo(live.at(-1)!.age / 2, 9);
    const stage = createStage(tl);
    stage.applyFrame({ ...matchFrameAt(tl, seg.zero + midFlight), camera: 'side', clip: 'replay' });
    const trail = stage.scene.getObjectByName('ball-trail') as Mesh;
    const pos = trail.geometry.getAttribute('position');
    const tail = new Vector3().fromBufferAttribute(pos, 2 * (slow.length - 1));
    const head = new Vector3().fromBufferAttribute(pos, 0);
    const p = slow.at(-1)!.pos;
    expect(tail.x).toBeCloseTo(p.x, 5);
    expect(tail.z).toBeCloseTo(-p.y, 5);
    expect(head.distanceTo(tail)).toBeGreaterThan(0);
  });

  it('tapers and fades to nothing at its tail', () => {
    const ages = [0, 0.05, 0.1, 0.15, BALL_LOOK.trail.sec];
    const styles = ages.map((age) => trailStyle(age));
    expect(styles[0]!.alpha).toBeGreaterThan(0.5);
    expect(styles[0]!.width).toBeLessThanOrEqual(2 * BALL_LOOK.radius);
    for (let i = 1; i < styles.length; i++) {
      expect(styles[i]!.alpha).toBeLessThan(styles[i - 1]!.alpha);
      expect(styles[i]!.width).toBeLessThan(styles[i - 1]!.width);
    }
    expect(styles.at(-1)!.alpha).toBe(0);
    expect(styles.at(-1)!.width).toBe(0);
  });

  it('draws as one ribbon on the stage while the ball flies, hidden between points', () => {
    const stage = createStage(tl);
    const trail = stage.scene.getObjectByName('ball-trail') as Mesh;
    stage.applyFrame({ ...matchFrameAt(tl, seg.zero + midFlight), camera: 'main' });
    expect(trail.visible).toBe(true);
    const n = trailPoints(seg.point, midFlight, tl.surface).length;
    expect(trail.geometry.drawRange.count).toBe((n - 1) * 6);
    const alpha = trail.geometry.getAttribute('alpha');
    expect(alpha.getX(0)).toBeGreaterThan(alpha.getX(2 * (n - 1)));
    stage.applyFrame({ ...matchFrameAt(tl, (seg.end + seg.next) / 2), camera: 'main' });
    expect(trail.visible).toBe(false);
  });

  it('keys off match time in a broadcast frame, whose t is programme time', () => {
    const programme = buildProgramme(tl, 'full');
    const T = seg.zero + midFlight;
    const frame = broadcastFrameAt(programme, programmeTimeFor(programme, T));
    expect(frame.t).not.toBeCloseTo(T, 3);
    const stage = createStage(tl);
    stage.applyFrame(frame);
    const trail = stage.scene.getObjectByName('ball-trail') as Mesh;
    expect(trail.visible).toBe(true);
    expect(trail.geometry.drawRange.count).toBe((trailPoints(seg.point, midFlight, tl.surface).length - 1) * 6);
    // The ribbon starts at the ball.
    const head = new Vector3().fromBufferAttribute(trail.geometry.getAttribute('position'), 0);
    expect(head.distanceTo(stage.scene.getObjectByName('ball')!.position)).toBeLessThan(1e-6);
  });
});
