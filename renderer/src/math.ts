// Small numeric helpers shared by playback and scene code.

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 0 → 1 with zero slope at both ends; u is clamped to [0, 1]. */
export const smoothstep = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};
