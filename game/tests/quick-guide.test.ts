import { describe, expect, it } from 'vitest';
import { finishQuick, nextOpponent } from '../src/quick/ladder.ts';
import { autoPlay, decide, decisionContext, matchOver, startQuick } from '../src/quick/match.ts';
import { habitCard, personaFor } from '../src/quick/persona.ts';
import { QUICK_GUIDE } from '../src/tuning.ts';
import { guideLine } from '../src/views/quick-scout.ts';
import { freshLadder, playLadderMatch } from './quick-helpers.ts';

// Proposal P4 option A: the first opponent always has a habit a new player can see, and the first match explains it.
describe('the guided first match', () => {
  it('fixes the first opponent\'s habit for good, rematches included', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = freshLadder(seed);
      expect(s.tutor).toBe(nextOpponent(s));
      expect(personaFor(s, s.tutor!).habit).toBe(QUICK_GUIDE.habit);
      expect(startQuick(s).persona.habit).toBe(QUICK_GUIDE.habit);
      const later = playLadderMatch(playLadderMatch(s).next).next;
      expect(personaFor(later, s.tutor!).habit).toBe(QUICK_GUIDE.habit);
    }
  });

  it('says at each decision of the first match what the habit predicts, and nothing after it', () => {
    const s = freshLadder(3);
    const m = startQuick(s);
    let lines = 0;
    for (autoPlay(m); !matchOver(m); autoPlay(m)) {
      const line = guideLine(s, m);
      const predicted = habitCard(decisionContext(m));
      if (predicted === 'attack') expect(line).toBe('Their habit says attack here: Counter beats Attack.');
      else expect(line).toMatch(/tell/);
      lines++;
      decide(m, 'defend');
    }
    expect(lines).toBeGreaterThan(0);
    const next = finishQuick(s, m);
    const m2 = startQuick(next);
    autoPlay(m2);
    if (!matchOver(m2)) expect(guideLine(next, m2)).toBeNull();
  });
});
