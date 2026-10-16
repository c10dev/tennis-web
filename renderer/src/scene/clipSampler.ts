// Clip sampling as a pure function of time (ADR-024): each bone's rotation (and the hips' position) is the weighted
// blend of the clips at t, looped. Replaces AnimationMixer, which skips writing a value that has not changed since its
// last update and so leaves whatever the stroke solver put on a bone in place.
import { LinearInterpolant, Quaternion, QuaternionLinearInterpolant, Vector3, type AnimationClip, type Bone, type Interpolant } from 'three';

interface Channel { bone: Bone; position: boolean; interpolant: Interpolant }
export interface SampledClip { readonly name: string; readonly duration: number; readonly channels: Channel[] }

/** Bind `clips` to the bones under `bones` (by name); tracks for missing bones are dropped. */
export function bindClips(clips: AnimationClip[], bones: Record<string, Bone>): SampledClip[] {
  return clips.map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    channels: clip.tracks.flatMap((track) => {
      const [name, property] = track.name.split('.') as [string, string];
      const bone = bones[name];
      if (!bone) return [];
      const position = property === 'position';
      const size = track.getValueSize();
      const interpolant = position ? new LinearInterpolant(track.times, track.values, size) : new QuaternionLinearInterpolant(track.times, track.values, size);
      return [{ bone, position, interpolant }];
    }),
  }));
}

interface Rest { quaternion: Quaternion; position: Vector3 }

/** Rest pose of every bone, captured once: what a bone holds where the clip weights add up to less than 1. */
export const restPose = (bones: Record<string, Bone>): Map<Bone, Rest> =>
  new Map(Object.values(bones).map((b) => [b, { quaternion: b.quaternion.clone(), position: b.position.clone() }]));

/** Pose the bones at time t from the clips with these weights (missing weights are 0). */
export function sampleClips(clips: SampledClip[], weights: Record<string, number>, t: number, rest: Map<Bone, Rest>): void {
  const quats = new Map<Bone, { q: Quaternion; w: number }>();
  const positions = new Map<Bone, { p: Vector3; w: number }>();
  const q = new Quaternion();
  for (const clip of clips) {
    const w = weights[clip.name] ?? 0;
    if (w <= 0) continue;
    const time = clip.duration > 0 ? ((t % clip.duration) + clip.duration) % clip.duration : 0;
    for (const c of clip.channels) {
      const v = c.interpolant.evaluate(time);
      if (c.position) {
        const acc = positions.get(c.bone) ?? { p: new Vector3(), w: 0 };
        acc.p.x += v[0]! * w;
        acc.p.y += v[1]! * w;
        acc.p.z += v[2]! * w;
        acc.w += w;
        positions.set(c.bone, acc);
      } else {
        q.set(v[0]!, v[1]!, v[2]!, v[3]!);
        const acc = quats.get(c.bone);
        if (!acc) {
          quats.set(c.bone, { q: new Quaternion(q.x * w, q.y * w, q.z * w, q.w * w), w });
          continue;
        }
        // Blend on the same hemisphere, then normalise (nlerp).
        const s = acc.q.dot(q) < 0 ? -w : w;
        acc.q.set(acc.q.x + q.x * s, acc.q.y + q.y * s, acc.q.z + q.z * s, acc.q.w + q.w * s);
        acc.w += w;
      }
    }
  }
  for (const [bone, r] of rest) {
    const qa = quats.get(bone);
    if (qa) {
      const left = Math.max(0, 1 - qa.w);
      const s = qa.q.dot(r.quaternion) < 0 ? -left : left;
      bone.quaternion.set(qa.q.x + r.quaternion.x * s, qa.q.y + r.quaternion.y * s, qa.q.z + r.quaternion.z * s, qa.q.w + r.quaternion.w * s).normalize();
    } else bone.quaternion.copy(r.quaternion);
    const pa = positions.get(bone);
    if (pa) bone.position.copy(pa.p).addScaledVector(r.position, Math.max(0, 1 - pa.w));
    else bone.position.copy(r.position);
  }
}
