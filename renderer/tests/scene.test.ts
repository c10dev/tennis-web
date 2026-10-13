import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshLambertMaterial, Vector3, type Object3D } from 'three';
import { COURT } from '@tennis/engine';
import { buildCourt } from '../src/scene/court.ts';
import { groundToThree, toThree } from '../src/scene/coords.ts';
import { createStage } from '../src/scene/stage.ts';
import { frameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { BALL, NET } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const box = (o: Object3D) => new Box3().setFromObject(o);
const named = (root: Object3D, name: string) => {
  const o = root.getObjectByName(name);
  if (!o) throw new Error(`no object named ${name}`);
  return o;
};
const colour = (o: Object3D) => ((o as Mesh).material as MeshLambertMaterial).color.getHex();

describe('coordinates', () => {
  it('maps court metres (z up, A at y < 0) to Three (y up), keeping a right-handed frame', () => {
    expect(toThree({ x: 1, y: 2, z: 3 })).toEqual(new Vector3(1, 3, -2));
    expect(groundToThree({ x: -4, y: 5 }, 0.01)).toEqual(new Vector3(-4, 0.01, -5));
    const ex = toThree({ x: 1, y: 0, z: 0 });
    const ey = toThree({ x: 0, y: 1, z: 0 });
    expect(new Vector3().crossVectors(ex, ey).equals(toThree({ x: 0, y: 0, z: 1 }))).toBe(true);
  });
});

describe('buildCourt', () => {
  const court = buildCourt('hard');

  it('draws the ITF lines where the engine\'s court is', () => {
    const near = box(named(court, 'line-baseline-near'));
    expect((near.min.z + near.max.z) / 2).toBeCloseTo(COURT.halfLength, 2);
    // Lines run to the outer edge of the doubles sidelines.
    expect(near.max.x - near.min.x).toBeGreaterThanOrEqual(2 * 5.485);
    expect(near.max.x - near.min.x).toBeLessThan(2 * 5.485 + 0.1);
    const right = box(named(court, 'line-singles-right'));
    expect((right.min.x + right.max.x) / 2).toBeCloseTo(COURT.halfWidth, 2);
    expect(right.max.z - right.min.z).toBeCloseTo(2 * COURT.halfLength, 1);
    const service = box(named(court, 'line-service-far'));
    expect((service.min.z + service.max.z) / 2).toBeCloseTo(-COURT.serviceLine, 2);
    expect(service.max.x - service.min.x).toBeCloseTo(2 * COURT.halfWidth, 1);
    const centre = box(named(court, 'line-centre-service'));
    expect(centre.max.z - centre.min.z).toBeCloseTo(2 * COURT.serviceLine, 1);
    for (const line of ['line-baseline-near', 'line-singles-right', 'line-service-far']) {
      expect(box(named(court, line)).min.y).toBeGreaterThan(0);
    }
  });

  it('hangs the net at 0.914 m in the middle and 1.07 m at the posts', () => {
    const net = named(court, 'net') as Mesh;
    const pos = net.geometry.getAttribute('position');
    const tops = Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).applyMatrix4(net.matrixWorld))
      .filter((v) => v.y > 0.5);
    const mid = tops.reduce((a, b) => (Math.abs(a.x) < Math.abs(b.x) ? a : b));
    const edge = tops.reduce((a, b) => (Math.abs(a.x) > Math.abs(b.x) ? a : b));
    expect(mid.y).toBeCloseTo(NET.centerHeight, 3);
    expect(edge.y).toBeCloseTo(NET.postHeight, 3);
    expect(box(named(court, 'net-post-right')).max.y).toBeCloseTo(NET.postHeight, 2);
  });

  it('gives each surface its own colours, and grass its mowing stripes', () => {
    const colours = (['hard', 'clay', 'grass'] as const).map((s) => colour(named(buildCourt(s), 'court-surface')));
    expect(new Set(colours).size).toBe(3);
    expect(buildCourt('grass').getObjectByName('grass-stripe-0')).toBeDefined();
    expect(buildCourt('hard').getObjectByName('grass-stripe-0')).toBeUndefined();
  });
});

describe('stage.applyFrame', () => {
  const tl = buildTimeline(match(2));
  const stage = createStage(tl);

  it('puts the ball, raised by its radius, and its shadow under it', () => {
    const seg = tl.segments[3]!;
    const f = frameAt(tl, seg.zero + seg.point.shots[1]!.t);
    stage.applyFrame(f);
    const ball = named(stage.scene, 'ball');
    const shadow = named(stage.scene, 'ball-shadow');
    expect(ball.visible).toBe(true);
    expect(ball.position.x).toBeCloseTo(f.ball!.x, 9);
    expect(ball.position.z).toBeCloseTo(-f.ball!.y, 9);
    expect(ball.position.y).toBeCloseTo(f.ball!.z + BALL.visualRadius, 9);
    expect(shadow.position.x).toBeCloseTo(ball.position.x, 9);
    expect(shadow.position.z).toBeCloseTo(ball.position.z, 9);
    expect(shadow.position.y).toBeLessThan(0.01);
  });

  it('hides the ball and its shadow between points', () => {
    const seg = tl.segments[3]!;
    stage.applyFrame(frameAt(tl, (seg.end + seg.next) / 2));
    expect(named(stage.scene, 'ball').visible).toBe(false);
    expect(named(stage.scene, 'ball-shadow').visible).toBe(false);
  });

  it('stands both players where the frame says', () => {
    const f = frameAt(tl, 30);
    stage.applyFrame(f);
    for (const id of ['A', 'B'] as const) {
      const rig = named(stage.scene, `player-${id}`);
      expect(rig.position.x).toBeCloseTo(f.players[id].pos.x, 9);
      expect(rig.position.z).toBeCloseTo(-f.players[id].pos.y, 9);
    }
  });
});
