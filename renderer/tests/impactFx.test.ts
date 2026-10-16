// The impact moment's look (ADR-024 S3, slice step 5): a star and speed lines at the contact while the hit-stop holds,
// fading through the slow motion after it; the ball squashed along the shot. Pure functions of the frame.
import { describe, expect, it } from 'vitest';
import { Mesh, Sprite, Vector3, type Object3D } from 'three';
import { broadcastFrameAt } from '../src/broadcast/frame.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import type { Clip } from '../src/broadcast/types.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { toThree } from '../src/scene/coords.ts';
import { createStage } from '../src/scene/stage.ts';
import { SAMPLE } from './fixtures.ts';

const tl = buildTimeline(SAMPLE[1]!);
const p = buildProgramme(tl, 'full', undefined, { style: 'game' });
const hold = p.clips.find((c) => c.kind === 'hitstop')!;
const after = p.clips[p.clips.indexOf(hold) + 1]!;
const shot = tl.segments[hold.pointIndex]!.point.shots.at(-1)!;
const stage = createStage(tl);
const star = () => stage.scene.getObjectByName('impact-star') as Sprite;
const lines = () => stage.scene.getObjectByName('impact-lines') as Sprite;
const ball = () => stage.scene.getObjectByName('ball') as Mesh;
const at = (clip: Clip, into: number) => broadcastFrameAt(p, clip.start + into);
const impactDraws = () => {
  let n = 0;
  stage.scene.getObjectByName('impact')!.traverseVisible((o: Object3D) => { if (o instanceof Mesh || o instanceof Sprite) n++; });
  return n;
};

describe('impact effects', () => {
  it('blooms a star and speed lines at the contact during the hit-stop', () => {
    stage.applyFrame(at(hold, hold.duration * 0.6));
    expect(star().visible).toBe(true);
    expect(lines().visible).toBe(true);
    expect(star().position.distanceTo(toThree(shot.from))).toBeLessThan(0.15);
    expect(star().scale.x).toBeGreaterThan(0.1);
  });

  it('squashes the ball along the shot while it holds', () => {
    stage.applyFrame(at(hold, hold.duration * 0.5));
    const s = ball().scale;
    expect(Math.max(s.x, s.z) / s.y).toBeGreaterThan(1.3);
  });

  it('fades out through the slow motion after the contact, and is gone in live play', () => {
    stage.applyFrame(at(after, 0.05));
    const early = (star().material as { opacity: number }).opacity;
    stage.applyFrame(at(after, after.duration * 0.9));
    expect((star().material as { opacity: number }).opacity).toBeLessThan(early);
    stage.applyFrame(broadcastFrameAt(p, hold.start - 2));
    expect(star().visible).toBe(false);
    expect(lines().visible).toBe(false);
    expect(ball().scale.x).toBeCloseTo(ball().scale.y, 6);
  });

  it('adds exactly two draws, and draws the same for the same moment whatever came before', () => {
    stage.applyFrame(broadcastFrameAt(p, hold.start - 2));
    expect(impactDraws()).toBe(0);
    stage.applyFrame(at(hold, 0.03));
    expect(impactDraws()).toBe(2);
    const first = { pos: star().position.clone(), scale: star().scale.x };
    stage.applyFrame(at(after, 0.4));
    stage.applyFrame(at(hold, 0.03));
    expect(star().position.distanceTo(first.pos)).toBeLessThan(1e-9);
    expect(star().scale.x).toBeCloseTo(first.scale, 9);
  });

  it('puts the frame’s clip time on the frame (match time stands still in a hit-stop)', () => {
    const f = at(hold, 0.04);
    expect(f.clipT).toBeCloseTo(0.04, 9);
    expect(f.matchT).toBeCloseTo(hold.matchFrom, 9);
    expect(new Vector3().copy(toThree(shot.from)).y).toBeGreaterThan(0);
  });
});
