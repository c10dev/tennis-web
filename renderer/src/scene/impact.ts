// The impact moment's look (ADR-024 S3): a comic star and speed lines at the deciding contact, blooming over the
// hit-stop and fading through the slow motion after it. Two camera-facing sprites on textures computed here (no DOM,
// no assets); a pure function of the frame, like the ball's pop and trail.
import { DataTexture, Group, LinearFilter, RGBAFormat, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import { clamp, smoothstep } from '../math.ts';
import type { Timeline } from '../playback/timeline.ts';
import { BROADCAST, IMPACT_LOOK, LOOK } from '../tuning/index.ts';
import { toThree } from './coords.ts';
import type { StageFrame } from './stage.ts';

type Shade = (x: number, y: number) => [number, number, number, number];

function texture(size: number, shade: Shade): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const rgba = shade((2 * i + 1) / size - 1, (2 * j + 1) / size - 1);
      data.set(rgba.map((v) => Math.round(clamp(v, 0, 1) * 255)), (j * size + i) * 4);
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

const ink = [((LOOK.outline.colour >> 16) & 255) / 255, ((LOOK.outline.colour >> 8) & 255) / 255, (LOOK.outline.colour & 255) / 255] as const;

/** A nine-pointed star, white with an ink rim. */
const star: Shade = (x, y) => {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  const edge = 0.55 + 0.4 * Math.abs(Math.cos(4.5 * a)) ** 2.5;
  if (r > edge) return [0, 0, 0, 0];
  return r > edge - 0.1 ? [ink[0], ink[1], ink[2], 1] : [1, 1, 1, 1];
};

/** Thin ink wedges radiating from an empty middle. */
const lines: Shade = (x, y) => {
  const r = Math.hypot(x, y);
  if (r < 0.45 || r > 1) return [0, 0, 0, 0];
  const a = Math.atan2(y, x) / (2 * Math.PI) + 0.5;
  const k = (a * IMPACT_LOOK.lines) % 1;
  const width = 0.06 * (1 - r) + 0.01;
  return Math.abs(k - 0.5) < width ? [ink[0], ink[1], ink[2], 0.7 * (1 - r) * 2] : [0, 0, 0, 0];
};

export interface ImpactView {
  readonly object3d: Group;
  apply(frame: StageFrame): void;
}

/** `timeline` is read on every frame: the stage's timeline can grow under it (Stage.setTimeline). */
export function createImpact(timeline: () => Timeline): ImpactView {
  const object3d = new Group();
  object3d.name = 'impact';
  const make = (name: string, map: DataTexture) => {
    const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    s.name = name;
    s.visible = false;
    object3d.add(s);
    return s;
  };
  const starSprite = make('impact-star', texture(64, star));
  const lineSprite = make('impact-lines', texture(128, lines));
  return {
    object3d,
    apply(frame) {
      const on = frame.clip === 'hitstop' || frame.clip === 'slowmo';
      const seg = timeline().segments[frame.pointIndex];
      const shot = seg?.point.shots.at(-1);
      const since = seg && shot ? (frame.matchT ?? frame.t) - seg.zero - shot.t : -1;
      starSprite.visible = lineSprite.visible = on && !!shot && since >= -1e-9;
      if (!starSprite.visible || !shot) return;
      // Over the hold the star blooms (match time stands still: clip time drives it); after it, it fades.
      const bloom = frame.clip === 'hitstop' ? smoothstep((frame.clipT ?? 0) / BROADCAST.impact.hitstopSec) : 1;
      const fade = frame.clip === 'slowmo' ? clamp(since / BROADCAST.impact.tailSec, 0, 1) : 0;
      const at = toThree(shot.from);
      starSprite.position.copy(at);
      lineSprite.position.copy(at);
      starSprite.scale.setScalar(IMPACT_LOOK.starSize * (0.4 + 0.6 * bloom) * (1 + 0.3 * fade));
      lineSprite.scale.setScalar(IMPACT_LOOK.linesSize * (0.7 + 0.3 * bloom));
      (starSprite.material as SpriteMaterial).opacity = 1 - fade;
      (lineSprite.material as SpriteMaterial).opacity = 1 - smoothstep(fade * 2);
    },
  };
}
