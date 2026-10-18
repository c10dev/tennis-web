// The player in TV pixels (ADR-031): pose-space proxies for what a phone shows at the Main camera on the M8 stage
// (TV_STAGE, CSS pixels), measured on the skinned vertices and the racket head's geometry.
import { Vector3, type Mesh, type SkinnedMesh } from 'three';
import type { PlayerId } from '@tennis/engine';
import { tvProjector } from '../../src/camera/tvView.ts';
import { heldPlayers, type TellStance } from '../../src/playback/hold.ts';
import type { PlayerPose } from '../../src/playback/pose.ts';
import type { Timeline } from '../../src/playback/timeline.ts';
import { GltfRig } from '../../src/scene/gltfRig.ts';
import type { PlayerModel } from '../../src/scene/playerModel.ts';
import { measure, type Sample } from './probe.ts';

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

/** The racket head's larger extent on screen. */
export function racketHeadPx(model: PlayerModel, pose: PlayerPose): number {
  const e = extent(vertices(posed(model, pose).object3d.getObjectByName('racket-head') as Mesh));
  return Math.max(e.w, e.h);
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

/** Mean on-screen distance between the same bones in two stances of player `id` (decision hold, `since` s in). */
export function stanceDistancePx(model: PlayerModel, tl: Timeline, id: PlayerId, a: TellStance | null, b: TellStance | null, since = 0.4): number {
  const joints = (tell: TellStance | null) => {
    const rig = posed(model, heldPlayers(tl, tell, since)[id]);
    const out: Vector3[] = [];
    rig.object3d.getObjectByName('model')!.traverse((o) => { if ((o as { isBone?: boolean }).isBone) out.push(new Vector3().setFromMatrixPosition(o.matrixWorld)); });
    out.push(new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName('racket-head')!.matrixWorld));
    return out.map(project);
  };
  const [pa, pb] = [joints(a), joints(b)];
  return pa.reduce((sum, p, i) => sum + Math.hypot(p.x - pb[i]!.x, p.y - pb[i]!.y), 0) / pa.length;
}
