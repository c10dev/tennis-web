import { describe, expect, it } from 'vitest';
import { createRng } from '@tennis/engine';
import { champion, playRound, roundsWon, startBracket, type Bracket } from '../src/tournament/bracket.ts';
import { makeDraw, seedOrder } from '../src/tournament/draw.ts';
import { entryList } from '../src/tournament/entry.ts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(2, '0')}`);

describe('seedOrder', () => {
  it('is the standard bracket order: top seeds meet as late as possible', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(new Set(seedOrder(64)).size).toBe(64);
  });
});

describe('makeDraw', () => {
  it('places every entrant once, seeds a quarter of the draw on the standard lines', () => {
    const entrants = ids(32);
    const slots = makeDraw(entrants, 32, createRng(1));
    expect(slots).toHaveLength(32);
    expect([...slots].sort()).toEqual([...entrants].sort());
    const order = seedOrder(32);
    order.forEach((seed, slot) => {
      if (seed <= 8) expect(slots[slot]).toBe(entrants[seed - 1]);
    });
    expect(slots[0]).toBe('p00');
    expect(slots[16]).toBe('p01');
  });

  it('gives byes to the top seeds when the field is short', () => {
    const slots = makeDraw(ids(13), 16, createRng(2));
    const byes = slots.flatMap((s, i) => (s === null ? [i] : []));
    expect(byes).toHaveLength(3);
    for (const b of byes) {
      const opponent = slots[b % 2 === 0 ? b + 1 : b - 1];
      expect(['p00', 'p01', 'p02']).toContain(opponent);
    }
  });

  it('shuffles the unseeded players by the seed it is given', () => {
    expect(makeDraw(ids(32), 32, createRng(3))).toEqual(makeDraw(ids(32), 32, createRng(3)));
    expect(makeDraw(ids(32), 32, createRng(3))).not.toEqual(makeDraw(ids(32), 32, createRng(4)));
  });
});

describe('bracket', () => {
  it('plays round by round to one champion, byes going through without a match', () => {
    let b: Bracket = startBracket(makeDraw(ids(13), 16, createRng(5)));
    let matches = 0;
    while (!champion(b)) {
      b = playRound(b, (x, y) => {
        matches++;
        return x < y ? x : y;
      });
    }
    expect(champion(b)).toBe('p00');
    expect(matches).toBe(12);
    expect(roundsWon(b, 'p00')).toBe(4);
    expect(roundsWon(b, 'p12')).toBe(0);
  });
});

describe('entryList', () => {
  it('takes the best-ranked of those who want in, up to the draw size', () => {
    const ranking = ids(64);
    const wants = (id: string) => Number(id.slice(1)) % 3 !== 0;
    const list = entryList(ranking, wants, 16);
    expect(list).toHaveLength(16);
    expect(list.every(wants)).toBe(true);
    expect(list).toEqual(ranking.filter(wants).slice(0, 16));
    expect(entryList(ranking, () => true, 64)).toEqual(ranking);
  });
});
