// Track A1 (ADR-023): the racket meets the ball where the engine says it was struck, and never jumps between frames.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { PlayerId } from '@tennis/engine';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { toThree } from '../src/scene/coords.ts';
import { MannequinRig } from '../src/scene/rig.ts';
import { SAMPLE, match } from './fixtures.ts';

const rigs: Record<PlayerId, MannequinRig> = { A: new MannequinRig(0xff0000), B: new MannequinRig(0x0000ff) };
const racketHead = (rig: MannequinRig) => {
  rig.object3d.updateWorldMatrix(true, true);
  return new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName('racket-head')!.matrixWorld);
};
const quantile = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]!;

describe('racket at contact', () => {
  const misses: Record<string, number[]> = { serve: [], forehand: [], backhand: [] };
  for (const r of SAMPLE) {
    const tl = buildTimeline(r);
    for (const seg of tl.segments) {
      for (const s of seg.point.shots) {
        const frame = matchFrameAt(tl, seg.zero + s.t);
        const rig = rigs[s.hitter];
        rig.apply(frame.players[s.hitter]);
        misses[s.shot === 'serve' ? 'serve' : (s.wing ?? 'forehand')]!.push(racketHead(rig).distanceTo(toThree(s.from)));
      }
    }
  }

  for (const kind of ['serve', 'forehand', 'backhand'] as const) {
    it(`puts the racket head on the ball for a ${kind}: p95 within 0.15 m, never beyond 0.3 m`, () => {
      const m = misses[kind]!;
      expect(m.length).toBeGreaterThan(100);
      expect(quantile(m, 0.95)).toBeLessThan(0.15);
      expect(Math.max(...m)).toBeLessThan(0.3);
    });
  }
});

describe('racket motion', () => {
  // Measured on the body, so this guards the arm alone; the whole body still turns in one frame when the ball goes
  // dead (facing snaps from the ball to the net), tracked in tech-debt.md (A1 facing snap).
  it('never jumps more than 0.7 m on the body between 60 fps frames, entering and leaving swings included', () => {
    const tl = buildTimeline(match(2, 'clay'));
    for (const id of ['A', 'B'] as const) {
      const rig = rigs[id];
      let prev: Vector3 | null = null;
      for (let t = 0; t < Math.min(tl.totalSec, 400); t += 1 / 60) {
        rig.apply(matchFrameAt(tl, t).players[id]);
        const head = rig.object3d.worldToLocal(racketHead(rig));
        if (prev) expect(head.distanceTo(prev), `${id} at ${t.toFixed(3)} s`).toBeLessThan(0.7);
        prev = head;
      }
    }
  });
});
