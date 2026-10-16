// The racket smear (ADR-024 S3, TD-063): in the impact moment, with the game look, a ribbon along the path the racket
// head swept just before, so the deciding swing reads as speed while the picture is slowed or held.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3, type Mesh } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import type { ClipKind } from '../src/broadcast/types.ts';
import type { StageFrame } from '../src/scene/stage.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { racketPath } from '../src/scene/smear.ts';
import { createStage } from '../src/scene/stage.ts';
import { IMPACT_LOOK } from '../src/tuning/index.ts';
import { match } from './fixtures.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const tl = buildTimeline(match(3));
const index = tl.segments.findIndex((s) => s.point.endedBy === 'winner');
const seg = tl.segments[index]!;
const last = seg.point.shots.at(-1)!;
const contact = seg.zero + last.t;
const head = (rig: GltfRig) => {
  rig.object3d.updateMatrixWorld(true);
  return new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName('racket-head')!.matrixWorld);
};
const frameAt = (t: number, clip: ClipKind): StageFrame => ({ ...matchFrameAt(tl, t), matchT: t, clip, camera: 'impact', clipT: 0 });

describe('racket smear', () => {
  it('follows the racket head through the times just before, newest first, and leaves the rig as a fresh one draws it', () => {
    const rig = new GltfRig(model);
    const fresh = new GltfRig(model);
    const t = contact + 0.05;
    const path = racketPath(tl, last.hitter, t, rig);
    expect(path.length).toBe(IMPACT_LOOK.smear.samples);
    path.forEach((p, i) => {
      expect(p.age).toBeCloseTo((i * IMPACT_LOOK.smear.sec) / (IMPACT_LOOK.smear.samples - 1), 9);
      fresh.apply(matchFrameAt(tl, t - p.age).players[last.hitter]);
      const h = head(fresh);
      // Court (x, y, height) against Three (x, height, −y).
      expect(Math.hypot(p.pos.x - h.x, p.pos.z - h.y, p.pos.y + h.z)).toBeLessThan(1e-9);
    });
    fresh.apply(matchFrameAt(tl, t).players[last.hitter]);
    expect(head(rig).distanceTo(head(fresh))).toBeLessThan(1e-9);
  });

  it('shows only in the impact moment with the game look', () => {
    const game = createStage(tl, { model });
    const smear = () => game.scene.getObjectByName('racket-smear') as Mesh;
    game.applyFrame(frameAt(contact, 'hitstop'));
    expect(smear().visible).toBe(true);
    game.applyFrame(frameAt(contact + 0.1, 'slowmo'));
    expect(smear().visible).toBe(true);
    game.applyFrame(frameAt(contact + 0.1, 'live'));
    expect(smear().visible).toBe(false);
    const plain = createStage(tl);
    plain.applyFrame(frameAt(contact, 'hitstop'));
    expect(plain.scene.getObjectByName('racket-smear')).toBeUndefined();
  });

  it('fades out after the contact', () => {
    const game = createStage(tl, { model });
    game.applyFrame(frameAt(contact + IMPACT_LOOK.smear.fadeSec + 0.01, 'slowmo'));
    expect((game.scene.getObjectByName('racket-smear') as Mesh).visible).toBe(false);
  });
});
