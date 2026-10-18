// What a 41 px player shows on the TV view (ADR-031 phase B): measured in CSS pixels on the M8 stage (TV_STAGE) by the
// pose-space projector, so the targets hold without a GPU. Baselines in docs/m8-character-motion.md §7.
import { describe, expect, it } from 'vitest';
import { Color, Mesh } from 'three';
import { heldPlayers } from '../src/playback/hold.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { COLOURS } from '../src/tuning/index.ts';
import { loadPlayerModelFile } from '../cli/motion/probe.ts';
import { racketHandlePx, racketHeadPx } from '../cli/motion/screen.ts';
import { match } from './fixtures.ts';

const model = loadPlayerModelFile();
const ready = heldPlayers(buildTimeline(match(2, 'clay')), null, 0.4);
const near = ready.A.pos.y < 0 ? ready.A : ready.B;

describe('B1: the racket on the TV view', () => {
  it('shows a head of at least 10 px and a handle of at least 2.2 px on the near player (8.4 and 1.6 before)', () => {
    expect(racketHeadPx(model, near)).toBeGreaterThanOrEqual(10);
    expect(racketHandlePx(model, near)).toBeGreaterThanOrEqual(2.2);
  });

  it('rims the light strings with a dark frame, outlines it all, in one draw and one hull', () => {
    const rig = new GltfRig(model);
    const racket = rig.object3d.getObjectByName('racket-mesh') as Mesh;
    const colours = racket.geometry.getAttribute('color');
    const hexes = new Set(Array.from({ length: colours.count }, (_, i) => new Color(colours.getX(i), colours.getY(i), colours.getZ(i)).getHex()));
    expect(hexes).toEqual(new Set([COLOURS.racket, COLOURS.strings]));
    expect(racket.children.filter((c) => c.userData.outline === true)).toHaveLength(1);
  });
});
