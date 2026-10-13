// Small numeric helpers shared by playback and scene code.

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 0 → 1 with zero slope at both ends; u is clamped to [0, 1]. */
export const smoothstep = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * 0 → 1 at constant speed with linear speed-up and slow-down over the first and last `ramp` of the way.
 * Peak speed is 1 / (1 − ramp) times the average (smoothstep's is 1.5×).
 */
export const trapezoid = (u: number, ramp = 0.2): number => {
  const k = clamp(u, 0, 1);
  const peak = 1 / (1 - ramp);
  if (k < ramp) return (peak * k * k) / (2 * ramp);
  if (k > 1 - ramp) return 1 - (peak * (1 - k) * (1 - k)) / (2 * ramp);
  return peak * (k - ramp / 2);
};
