export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
export const logit = (p: number): number => Math.log(p / (1 - p));
/** A base rate for average players, shifted on the logit scale. */
export const shifted = (base: number, shift: number): number => sigmoid(logit(base) + shift);
