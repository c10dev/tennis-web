// The player in TV pixels (ADR-031): pose-space proxies for what a phone shows at the Main camera on the M8 stage
// (TV_STAGE, CSS pixels), measured on the skinned vertices and the racket head's geometry.
import { Vector3, type Mesh, type SkinnedMesh } from 'three';
import { PLAYER_RIG } from '../../src/tuning/index.ts';
import type { PlayerId } from '@tennis/engine';
import { tvProjector } from '../../src/camera/tvView.ts';
import { heldPlayers, type TellStance } from '../../src/playback/hold.ts';
import type { PlayerPose } from '../../src/playback/pose.ts';
import type { Timeline } from '../../src/playback/timeline.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import type { PlayerModel } from '../../src/scene/playerModel.ts';
import { JOINTS, measure, type Sample } from './probe.ts';

const project = tvProjector(null);

function extent(points: Iterable<Vector3>): { w: number; h: number } {
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of points) {
    const s = project(p);
    [x0, x1, y0, y1] = [Math.min(x0, s.x), Math.max(x1, s.x), Math.min(y0, s.y), Math.max(y1, s.y)];
  }
  return { w: x1 - x0, h: y1 - y0 };
}

function* vertices(mesh: Mesh | SkinnedMesh): Generator<Vector3> {
  const n = mesh.geometry.getAttribute('position').count;
  for (let i = 0; i < n; i++) yield mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
}

function posed(model: PlayerModel, pose: PlayerPose): GltfRig {
  const rig = new GltfRig(model);
  measure(rig, { t: 0, pose, phase: 'play' });
  return rig;
}

/** Height on screen of the posed body, head to toe. */
export const bodyHeightPx = (model: PlayerModel, pose: PlayerPose): number =>
  extent(vertices(posed(model, pose).object3d.getObjectByName('body') as SkinnedMesh)).h;

/** The racket head's larger extent on screen: its oval rim, frame included, around the head's centre. */
export function racketHeadPx(model: PlayerModel, pose: PlayerPose): number {
  const head = posed(model, pose).object3d.getObjectByName('racket-head')!;
  const R = PLAYER_RIG.racket;
  const rim = Array.from({ length: 24 }, (_, k) => {
    const a = (2 * Math.PI * k) / 24;
    return new Vector3((R.headRadius + R.frameTube) * R.headAspect * Math.cos(a), (R.headRadius + R.frameTube) * Math.sin(a), 0).applyMatrix4(head.matrixWorld);
  });
  const e = extent(rim);
  return Math.max(e.w, e.h);
}

/** The handle's width on screen: its diameter at its middle, by the pixels a metre spans there across the view. */
export function racketHandlePx(model: PlayerModel, pose: PlayerPose): number {
  const mid = new Vector3().setFromMatrixPosition(posed(model, pose).object3d.getObjectByName('racket-handle')!.matrixWorld);
  const [a, b] = [project(mid), project(mid.clone().add(new Vector3(1, 0, 0)))];
  return 2 * PLAYER_RIG.racket.handleRadius * Math.hypot(b.x - a.x, b.y - a.y);
}

/** How far the racket head ranges around the player's feet on screen over samples (one stroke's window): the larger
 *  side of the box its offsets fill, so the swing counts and the run does not. */
export function racketSpanPx(s: readonly Sample[]): number {
  const offsets = s.map((x) => {
    const r = project(x.racket);
    const g = project(new Vector3(x.pose.pos.x, 0, -x.pose.pos.y));
    return { x: r.x - g.x, y: r.y - g.y };
  });
  const xs = offsets.map((o) => o.x);
  const ys = offsets.map((o) => o.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** Mean on-screen distance between the same joints (JOINTS: knees, ankles, elbows, hands, head, racket head) in two
 *  stances of player `id` in the decision hold, the most over `times` (hold seconds). */
export function stanceDistancePx(model: PlayerModel, tl: Timeline, id: PlayerId, a: TellStance | null, b: TellStance | null, times = STANCE_TIMES): number {
  const joints = (tell: TellStance | null, since: number) => {
    const rig = posed(model, heldPlayers(tl, tell, since)[id]);
    return JOINTS.map((n) => project(new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld)));
  };
  // A tell that moves (a bounce, a sway, a half-step) shows by its motion: the farthest the two get apart over a cycle.
  return Math.max(...times.map((since) => {
    const [pa, pb] = [joints(a, since), joints(b, since)];
    return pa.reduce((sum, p, i) => sum + Math.hypot(p.x - pb[i]!.x, p.y - pb[i]!.y), 0) / pa.length;
  }));
}

/** Hold seconds the stance distance is sampled at: across a second, the slowest cue's half cycle. */
const STANCE_TIMES = [0.3, 0.55, 0.8, 1.05, 1.3];
