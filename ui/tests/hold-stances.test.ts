import { describe, expect, it } from 'vitest';
import { CARDS, en, ko } from '@tennis/game';
import { HOLD_STANCES } from '@tennis/renderer';

// The decision hold shows the tell on the opponent's body (ADR-024, TD-061): one stance per tell text, by index.
describe('hold stances against the tell texts', () => {
  it('has a stance for every tell of every card, in every language', () => {
    for (const card of CARDS) {
      expect(HOLD_STANCES[card]).toHaveLength(en.tells[card].length);
      expect(HOLD_STANCES[card]).toHaveLength(ko.tells[card].length);
    }
  });
});
