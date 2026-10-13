import { describe, expect, it } from 'vitest';
import { broadcastFrameAt, type BroadcastFrame } from '../src/broadcast/frame.ts';
import { buildProgramme } from '../src/broadcast/programme.ts';
import { cameraPose } from '../src/camera/cameras.ts';
import { mainCamPose } from '../src/camera/mainCam.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { standHeightAt } from '../src/scene/venue.ts';
import { match } from './fixtures.ts';

type P = { x: number; y: number; z: number };
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: P) => Math.hypot(v.x, v.y, v.z);
const unit = (v: P) => ({ x: v.x / len(v), y: v.y / len(v), z: v.z / len(v) });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y + a.z * b.z;
/** Court (x, y, height) → Three (x, height, −y). */
const three = (x: number, y: number, h: number): P => ({ x, y: h, z: -y });

const tl = buildTimeline(match(2, 'hard'));
const p = buildProgramme(tl, 'full');
const frames = (camera: string) => {
  const out: BroadcastFrame[] = [];
  for (const c of p.clips.filter((x) => x.camera === camera).slice(0, 25)) out.push(broadcastFrameAt(p, c.start + c.duration / 2));
  return out;
};

describe('cameraPose', () => {
  it('main is the TV camera, panned', () => {
    const f = frames('main')[0]!;
    expect(cameraPose(f, 0.7)).toEqual(mainCamPose(0.7));
  });

  it('serve: low behind the server, looking down the court past them', () => {
    for (const f of frames('serve')) {
      const s = f.players[f.focus!].pos;
      const pose = cameraPose(f, 0);
      const server = three(s.x, s.y, 1.2);
      expect(Math.abs(pose.position.z)).toBeGreaterThan(Math.abs(server.z));
      expect(len(sub(pose.position, server))).toBeGreaterThan(2.5);
      expect(len(sub(pose.position, server))).toBeLessThan(6);
      expect(pose.position.y).toBeLessThan(3);
      const look = unit(sub(pose.target, pose.position));
      expect(dot(look, unit(sub(three(0, 0, 0.5), pose.position)))).toBeGreaterThan(0.8);
    }
  });

  it('reaction: a close-up of the point winner from the net side', () => {
    for (const f of frames('reaction')) {
      const w = f.players[f.focus!];
      const pose = cameraPose(f, 0);
      const head = three(w.pos.x, w.pos.y, 1.6);
      expect(len(sub(pose.target, head))).toBeLessThan(0.3);
      expect(len(sub(pose.position, head))).toBeGreaterThan(3);
      expect(len(sub(pose.position, head))).toBeLessThan(6);
      expect(Math.abs(pose.position.z)).toBeLessThan(Math.abs(head.z));
    }
  });

  it('side: a wide shot from beyond the umpire, following the ball in replays', () => {
    const wide = frames('side').find((f) => f.clip !== 'replay')!;
    const pose = cameraPose(wide, 0);
    expect(pose.position.x).toBeLessThan(-12);
    expect(len(sub(pose.target, three(0, 0, 0)))).toBeLessThan(2);
    const replay = frames('side').find((f) => f.clip === 'replay' && f.ball)!;
    const r = cameraPose(replay, 0);
    expect(len(sub(r.target, three(replay.ball!.x, replay.ball!.y, replay.ball!.z)))).toBeLessThan(1e-9);
  });

  it('hawkeye: looks down at the mark from close by', () => {
    for (const f of frames('hawkeye')) {
      const pose = cameraPose(f, 0);
      const mark = three(f.hawkeye!.mark.x, f.hawkeye!.mark.y, 0);
      expect(len(sub(pose.target, mark))).toBeLessThan(1e-9);
      expect(len(sub(pose.position, mark))).toBeLessThan(2.5);
      expect(pose.position.y).toBeGreaterThan(0.8);
    }
  });

  it('never puts a camera underground or inside the stands', () => {
    for (const camera of ['main', 'serve', 'reaction', 'side', 'hawkeye']) {
      for (const f of frames(camera)) {
        const { position: c } = cameraPose(f, 0);
        expect(c.y).toBeGreaterThan(standHeightAt(c.x, -c.z) + 0.3);
      }
    }
  });
});
