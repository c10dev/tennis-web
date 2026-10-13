// Seeded random streams for the career: one per purpose, so adding draws to one never shifts another.
import { createRng, deriveSeed, type Rng } from '@tennis/engine';

/** FNV-1a of a stream name, so streams are addressed by readable keys. */
function key(parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5;
  const text = parts.join('/');
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

export const streamSeed = (seed: number, ...parts: (string | number)[]): number => deriveSeed(seed, key(parts));
export const stream = (seed: number, ...parts: (string | number)[]): Rng => createRng(streamSeed(seed, ...parts));

export const uniform = (rng: Rng, lo: number, hi: number): number => lo + (hi - lo) * rng.next();
export const int = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng.next() * (hi - lo + 1));
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)]!;

/** Standard normal by Box–Muller (two draws). */
export function normal(rng: Rng): number {
  const u = 1 - rng.next();
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
