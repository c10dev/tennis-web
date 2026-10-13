// Seeded draws: a quarter of the field seeded on the standard lines, byes against the top seeds, the rest shuffled.
import type { Rng } from '@tennis/engine';

/** Seed number on each line of a standard bracket of `size` (a power of two): 1 and 2 can only meet in the final. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length;
    order = order.flatMap((s) => [s, 2 * n + 1 - s]);
  }
  return order;
}

/** `entrants` best first; null slots are byes. */
export function makeDraw(entrants: readonly string[], size: number, rng: Rng): (string | null)[] {
  if (entrants.length > size) throw new RangeError(`${entrants.length} entrants do not fit a draw of ${size}`);
  const seeds = Math.min(size / 4, entrants.length);
  const order = seedOrder(size);
  const unseeded = entrants.slice(seeds);
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j]!, unseeded[i]!];
  }
  let next = 0;
  return order.map((line) => {
    if (line > entrants.length) return null;
    return line <= seeds ? entrants[line - 1]! : unseeded[next++]!;
  });
}
