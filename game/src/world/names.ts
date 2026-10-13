// Made-up player names from syllables: no real players, no nationalities (GDD §11).
import type { Rng } from '@tennis/engine';
import { pick } from '../rng.ts';

const FIRST = ['Al', 'Bren', 'Cas', 'Dar', 'El', 'Fen', 'Gar', 'Hal', 'Ivo', 'Jor', 'Kai', 'Lio', 'Mar', 'Nil', 'Oren', 'Pav',
  'Quin', 'Ras', 'Sven', 'Tob', 'Ulf', 'Vic', 'Wes', 'Yan', 'Zeb'];
const FIRST_END = ['', 'an', 'el', 'o', 'is', 'ek', 'in'];
const LAST = ['Ash', 'Bran', 'Cort', 'Dun', 'Eck', 'Fal', 'Grim', 'Holt', 'Ister', 'Jask', 'Kov', 'Lund', 'Mor', 'Nask', 'Orl',
  'Pell', 'Rook', 'Sarn', 'Tor', 'Vard', 'Wren', 'Yarr', 'Zell'];
const LAST_END = ['ford', 'by', 'sen', 'ov', 'ic', 'ley', 'mann', 'ton', 'ar', 'is'];

/** A name not in `taken` (which it extends). */
export function uniqueName(rng: Rng, taken: Set<string>): string {
  for (;;) {
    const name = `${pick(rng, FIRST)}${pick(rng, FIRST_END)} ${pick(rng, LAST)}${pick(rng, LAST_END)}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
}
