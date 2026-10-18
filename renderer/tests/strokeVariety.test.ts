// Strokes from what the events carry (ADR-031 B4): swing size by pace, the finish by spin, the backswing and crouch by
// the contact's height, and every backhand two-handed (Q6). Contact accuracy is strokeRig.test.ts's.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { ShotEvent } from '@tennis/engine';
import { matchFrameAt } from '../src/playback/frame.ts';
import { keysFor } from '../src/playback/stroke.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { PLAYER_RIG } from '../src/tuning/index.ts';
import { loadPlayerModelFile } from '../cli/motion/probe.ts';
import { match } from './fixtures.ts';

const tl = buildTimeline(match(2, 'clay'));
const drives = tl.segments.flatMap((seg) => seg.point.shots.filter((s) => s.shot !== 'serve').map((s) => ({ s, t: seg.zero + s.t })));
const fore = drives.filter((d) => d.s.wing === 'forehand').map((d) => d.s);
const by = (list: ShotEvent[], f: (s: ShotEvent) => number) => [...list].sort((a, b) => f(a) - f(b));
const reach = (k: { hand: readonly number[] }) => Math.hypot(k.hand[0]! - PLAYER_RIG.shoulderR[0], k.hand[1]! - PLAYER_RIG.shoulderR[1], k.hand[2]! - PLAYER_RIG.shoulderR[2]);

describe('strokes from the events', () => {
  it('are the same keys for the same shot', () => {
    expect(keysFor('forehand', fore[0]!)).toEqual(keysFor('forehand', fore[0]!));
  });

  it('swing bigger on a faster ball: the backswing hand further from the shoulder', () => {
    const s = fore[0]!;
    const [slow, fast] = [keysFor('forehand', { ...s, speedKmh: 92 }), keysFor('forehand', { ...s, speedKmh: 140 })];
    expect(reach(fast[1]!)).toBeGreaterThan(reach(slow[1]!) + 0.1);
  });

  it('finish higher with more spin', () => {
    const [flat, spun] = [by(fore, (s) => s.spinRpm)[0]!, by(fore, (s) => s.spinRpm).at(-1)!];
    expect(keysFor('forehand', spun)[3]!.hand[1]).toBeGreaterThan(keysFor('forehand', flat)[3]!.hand[1] + 0.1);
  });

  // The planned crouch is modest (lowDrop): deeper, the folded legs leave no room to lift a stepping foot (A5), and the
  // solver still crouches further for a ball the racket cannot reach.
  it('crouch for a low ball and take the racket back higher for a high one', () => {
    const [low, high] = [by(fore, (s) => s.from.z)[0]!, by(fore, (s) => s.from.z).at(-1)!];
    expect(keysFor('forehand', low)[2]!.drop).toBeGreaterThan(keysFor('forehand', high)[2]!.drop + 0.03);
    expect(keysFor('forehand', high)[1]!.hand[1]).toBeGreaterThan(keysFor('forehand', low)[1]!.hand[1] + 0.2);
  });

  it('hits every backhand two-handed: the free hand on the grip from the backswing to the finish', () => {
    const rig = new GltfRig(loadPlayerModelFile());
    const at = (n: string) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld);
    const gaps: number[] = [];
    for (const { s, t } of drives.filter((d) => d.s.wing === 'backhand').slice(0, 40)) {
      for (const dt of [-0.18, -0.08, 0, 0.1, 0.22]) {
        rig.apply(matchFrameAt(tl, t + dt).players[s.hitter]);
        rig.object3d.updateMatrixWorld(true);
        gaps.push(at('handl').distanceTo(at('handr')));
      }
    }
    expect(gaps.length).toBeGreaterThan(100);
    expect(gaps.filter((g) => g < 0.2).length).toBeGreaterThan(gaps.length * 0.9);
  });
});
