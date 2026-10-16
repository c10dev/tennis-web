// The skinned player rig (ADR-024, slice step 1): the committed model built without a browser, standing at Pop
// proportions where the pose says, with a racket in the right hand and an ink outline that follows the skin.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Box3, Mesh, SkinnedMesh, Vector3, type Bone } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import type { PlayerPose } from '../src/playback/pose.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { isOutline } from '../src/scene/outline.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { PLAYER_MODEL, PLAYER_RIG } from '../src/tuning/index.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));

const pose = (over: Partial<PlayerPose> = {}): PlayerPose => ({
  pos: { x: 1, y: -11 }, facing: { x: 0, y: 1 }, speed: 0, swing: null, reaction: 'none', reactionWeight: 0,
  gait: { phase: 0, amount: 0 }, crouch: 0, splitStep: 0, toss: 0, t: 0, stroke: null, ...over,
});

function skinnedBox(rig: GltfRig): Box3 {
  rig.object3d.updateMatrixWorld(true);
  const body = rig.object3d.getObjectByName('body') as SkinnedMesh;
  const box = new Box3();
  const v = new Vector3();
  const count = body.geometry.attributes.position!.count;
  for (let i = 0; i < count; i++) box.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld));
  return box;
}
const bone = (rig: GltfRig, name: string) => rig.object3d.getObjectByName(name) as Bone;
const world = (o: { matrixWorld: { elements: number[] } }) => new Vector3().setFromMatrixPosition(o.matrixWorld as never);

describe('player model', () => {
  it('builds one skinned body with the full skeleton and the kept clips', () => {
    const body = model.root.getObjectByName('body');
    expect(body).toBeInstanceOf(SkinnedMesh);
    const mesh = body as SkinnedMesh;
    expect(mesh.geometry.index!.count / 3).toBeLessThanOrEqual(5000);
    expect(mesh.skeleton.bones).toHaveLength(41);
    expect(model.clips.map((c) => c.name).sort()).toEqual([...PLAYER_MODEL.clips].sort());
    for (const name of ['hips', 'head', 'handr', 'handslotr', 'footl']) expect(model.root.getObjectByName(name), name).toBeDefined();
  });
});

describe('GltfRig', () => {
  it('stands at Pop proportions on the ground where the pose says', () => {
    const rig = new GltfRig(model);
    rig.apply(pose());
    const box = skinnedBox(rig);
    const height = box.max.y - box.min.y;
    expect(height).toBeGreaterThan(PLAYER_RIG.height - 0.1);
    expect(height).toBeLessThan(PLAYER_RIG.height + 0.1);
    expect(box.min.y).toBeGreaterThan(-0.03);
    expect(box.min.y).toBeLessThan(0.06);
    const centre = box.getCenter(new Vector3());
    // Court (1, −11) is Three (1, ·, 11).
    expect(Math.hypot(centre.x - 1, centre.z - 11)).toBeLessThan(0.3);
    // About three heads: the head bone is scaled down uniformly (a leaf, so nothing shears).
    expect(bone(rig, 'head').scale.x).toBeCloseTo(PLAYER_RIG.headScale);
  });

  it('faces the way the pose faces', () => {
    const rig = new GltfRig(model);
    for (const facing of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }]) {
      rig.apply(pose({ facing }));
      rig.object3d.updateMatrixWorld(true);
      const forward = world(bone(rig, 'toesl')).sub(world(bone(rig, 'footl')));
      // Court (x, y) is Three (x, −y).
      expect(forward.x * facing.x - forward.z * facing.y, JSON.stringify(facing)).toBeGreaterThan(0);
    }
  });

  it('holds a racket in the right hand', () => {
    const rig = new GltfRig(model);
    rig.apply(pose());
    rig.object3d.updateMatrixWorld(true);
    const head = rig.object3d.getObjectByName('racket-head')!;
    let parent = head.parent;
    while (parent && parent.name !== 'handslotr') parent = parent.parent;
    expect(parent?.name).toBe('handslotr');
    const reach = world(head).distanceTo(world(bone(rig, 'handr')));
    expect(reach).toBeGreaterThan(PLAYER_RIG.racket.length * 0.8);
    expect(reach).toBeLessThan(PLAYER_RIG.racket.length * 1.3);
  });

  it('outlines the skin and the racket head with two hulls; the body hull bends with the skeleton', () => {
    const rig = new GltfRig(model);
    const hulls: Mesh[] = [];
    rig.object3d.traverse((o) => { if (isOutline(o)) hulls.push(o as Mesh); });
    expect(hulls).toHaveLength(2);
    const skinHull = hulls.find((h) => h instanceof SkinnedMesh) as SkinnedMesh;
    const body = rig.object3d.getObjectByName('body') as SkinnedMesh;
    expect(skinHull.skeleton).toBe(body.skeleton);
  });

  it('draws in at most six calls with outlines on', () => {
    const rig = new GltfRig(model);
    let draws = 0;
    rig.object3d.traverse((o) => { if (o instanceof Mesh && o.visible) draws++; });
    expect(draws).toBeLessThanOrEqual(6);
  });

  it('is a function of the pose alone: the same pose after any other gives the same bones', () => {
    const a = new GltfRig(model);
    const b = new GltfRig(model);
    a.apply(pose({ t: 3.3, speed: 6, gait: { phase: 2, amount: 1 } }));
    a.apply(pose({ t: 1.2, speed: 2 }));
    b.apply(pose({ t: 1.2, speed: 2 }));
    for (const name of ['hips', 'chest', 'upperarmr', 'lowerlegl']) {
      expect(bone(a, name).quaternion.angleTo(bone(b, name).quaternion), name).toBeLessThan(1e-6);
    }
  });

  it('reports its chains for the stroke keys of step 2', () => {
    const rig = new GltfRig(model);
    rig.apply(pose());
    rig.object3d.updateMatrixWorld(true);
    const at = (n: string) => world(bone(rig, n));
    const chains = {
      shoulderHeight: at('upperarmr').y,
      upperArm: at('upperarmr').distanceTo(at('lowerarmr')),
      foreArm: at('lowerarmr').distanceTo(at('handr')),
      thigh: at('upperlegr').distanceTo(at('lowerlegr')),
      shin: at('lowerlegr').distanceTo(at('footr')),
      hipHeight: at('hips').y,
    };
    console.log('chains (m):', Object.fromEntries(Object.entries(chains).map(([k, v]) => [k, Number(v.toFixed(3))])));
    expect(chains.shoulderHeight).toBeGreaterThan(0.9);
  });
});
