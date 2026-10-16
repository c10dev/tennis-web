// Feet on the ground (ADR-024, slice step 3): strides follow the distance travelled and strokes plant the feet, so a
// foot in stance stays put. Thresholds are the measured state of the slice (TD-058 records what is left).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { readGlb } from '../src/asset/glb.ts';
import { matchFrameAt } from '../src/playback/frame.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { GltfRig } from '../src/scene/gltfRig.ts';
import { buildPlayerModel } from '../src/scene/playerModel.ts';
import { match } from './fixtures.ts';

const model = buildPlayerModel(readGlb(new Uint8Array(readFileSync(new URL('../../ui/public/models/player.glb', import.meta.url)))));
const quantile = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]!;

/** Per-frame ground slip of feet in stance (toes within 5 cm of the ground in both frames), by what the body does. */
function slips(): Record<'run' | 'walk' | 'planted', number[]> {
  const tl = buildTimeline(match(2, 'clay'));
  const out = { run: [] as number[], walk: [] as number[], planted: [] as number[] };
  for (const id of ['A', 'B'] as const) {
    const rig = new GltfRig(model);
    const at = (n: string) => new Vector3().setFromMatrixPosition(rig.object3d.getObjectByName(n)!.matrixWorld);
    let prev: Vector3[] | null = null;
    for (let t = 0; t < 300; t += 1 / 60) {
      const p = matchFrameAt(tl, t).players[id];
      rig.apply(p);
      rig.object3d.updateMatrixWorld(true);
      const cur = [at('footl'), at('footr'), at('toesl'), at('toesr')];
      if (prev) {
        for (const i of [0, 1]) {
          if (cur[i + 2]!.y > 0.05 || prev[i + 2]!.y > 0.05) continue;
          const d = Math.hypot(cur[i]!.x - prev[i]!.x, cur[i]!.z - prev[i]!.z);
          if (p.stroke && p.stroke.plant.weight > 0.99) out.planted.push(d);
          else if (p.stroke || p.reactionWeight > 0) continue;
          else if (p.speed > 3) out.run.push(d);
          else if (p.speed > 0.6) out.walk.push(d);
        }
      }
      prev = cur;
    }
  }
  return out;
}

describe('feet', () => {
  const s = slips();
  it('running: a foot in stance slips no more than the clip itself does (median 6 mm, p95 3.5 cm per 60 fps frame)', () => {
    expect(s.run.length).toBeGreaterThan(200);
    expect(quantile(s.run, 0.5)).toBeLessThan(0.006);
    expect(quantile(s.run, 0.95)).toBeLessThan(0.035);
  });
  it('walking and the walk–run blend: median 8 mm, p95 4.5 cm', () => {
    expect(quantile(s.walk, 0.5)).toBeLessThan(0.008);
    expect(quantile(s.walk, 0.95)).toBeLessThan(0.045);
  });
  it('planted for a stroke: the feet hold (median under 1 mm; the rest are steps where a leg cannot reach)', () => {
    expect(s.planted.length).toBeGreaterThan(1000);
    expect(quantile(s.planted, 0.5)).toBeLessThan(0.001);
    expect(quantile(s.planted, 0.95)).toBeLessThan(0.1);
  });
});
