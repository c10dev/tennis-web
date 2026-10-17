// The decision hold's stances on the skinned rig (ADR-024 S2, TD-061): the ready stance holds the racket in front,
// and the tells read on the body.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type Card } from '@tennis/engine';
import { readGlb } from '../src/asset/glb.ts';
import { heldPlayers } from '../src/playback/hold.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } });
const events = simulateMatch(config, 2).events;
const cut = events.findIndex((e, i) => e.type === 'point' && events.slice(0, i).filter((x) => x.type === 'point').length === 6);
const timeline = buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: events.slice(0, cut) });
const rig = new GltfRig(model);

/** World positions after posing B for this tell (or none), in B's own frame: x to their left, z towards the net. */
function posed(tell: { card: Card; index: number } | null, t = 0.4) {
  const pose = heldPlayers(timeline, tell && { player: 'B', ...tell }, t).B;
  rig.apply(pose);
  rig.object3d.updateMatrixWorld(true);
  const local = (name: string) => rig.object3d.worldToLocal(new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(name)!.matrixWorld));
  return { hips: local('hips'), head: local('head'), racket: local('racket-head'), hand: local('handl') };
}

describe('hold stances on the skinned rig', () => {
  it('holds the racket in front of the body at chest height in the ready stance', () => {
    const p = posed(null);
    expect(p.racket.z).toBeGreaterThan(p.hips.z + 0.25);
    expect(p.racket.y).toBeGreaterThan(p.hips.y);
  });

  it('bends the knees for “settles deep, knees bent”: the hips sit lower', () => {
    expect(posed({ card: 'defend', index: 1 }).hips.y).toBeLessThan(posed(null).hips.y - 0.08);
  });

  it('puts the head forward for “watches your feet closely”, and the racket out for “holds the racket out in front”', () => {
    expect(posed({ card: 'counter', index: 1 }).head.z).toBeGreaterThan(posed(null).head.z + 0.06);
    expect(posed({ card: 'counter', index: 2 }).racket.z).toBeGreaterThan(posed(null).racket.z + 0.1);
  });

  it('raises the free hand to the face for “towels off”', () => {
    expect(posed({ card: 'defend', index: 3 }).hand.y).toBeGreaterThan(posed(null).hand.y + 0.3);
  });
});
