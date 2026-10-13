import { describe, expect, it } from 'vitest';
import { advance, isOver, replayMatch, setTactic, startMatch, finish } from '../src/match/live.ts';
import { matchMetrics } from '../src/match/metrics.ts';
import { DEFAULT_TACTIC, simulateMatch } from '../src/match/simulateMatch.ts';
import { exhibitionConfig } from '../src/match/exhibition.ts';
import { fingerprint } from '../src/match/fingerprint.ts';
import type { Card, MatchConfig, MatchRecipe, PointCards, SetFormat, TacticChange } from '../src/types.ts';

// Found by a bug hunt (2026-10-14): recipes with both cards and tactic changes, and tiebreak sets outside 7-6.
const CARDS: Card[] = ['attack', 'defend', 'counter'];

describe('replayMatch with cards and tactic changes', () => {
  it('plays the same match as point-by-point live play', () => {
    const config = exhibitionConfig('clay');
    const live = startMatch(config, 11);
    const cards: (PointCards | null)[] = [];
    const changes: TacticChange[] = [];
    let sets = 0;
    while (!isOver(live)) {
      if (live.state.betweenSets && sets === 1 && changes.length === 0) {
        const change = { afterSet: 1, player: 'B' as const, tactic: { ...DEFAULT_TACTIC, aggression: 1 } };
        setTactic(live, change.player, change.tactic);
        changes.push(change);
      }
      const i = live.state.points.length;
      const c = i % 4 === 0 ? null : { A: CARDS[i % 3]!, B: CARDS[(i * 5) % 3]! };
      cards.push(c);
      advance(live, 'point', c ? { cards: c } : {});
      if (live.state.betweenSets) sets++;
    }
    expect(changes).toHaveLength(1);
    const recipe: MatchRecipe = { config, seed: 11, tacticChanges: changes, cards };
    expect(fingerprint(replayMatch(recipe))).toBe(fingerprint(finish(live)));
  });
});

describe('matchMetrics tiebreak sets', () => {
  const rules = (setFormat: SetFormat): MatchConfig => ({ ...exhibitionConfig('hard'), rules: { bestOf: 3, noAd: true, finalSet: 'tiebreak7', setFormat } });

  it('counts every set decided in a tiebreak, Fast4 and one-tiebreak sets included', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const format of ['standard', 'fast4', 'tiebreak'] as const) {
        const r = simulateMatch(rules(format), seed);
        // A set was decided in a tiebreak when its last point was played in one.
        let expected = 0;
        let lastTiebreak = false;
        for (const e of r.events) {
          if (e.type === 'point') lastTiebreak = e.scoreBefore.tiebreak;
          if (e.type === 'set_end' && lastTiebreak) expected++;
        }
        expect(matchMetrics(r).tiebreakSets, `${format} seed ${seed}`).toBe(expected);
      }
    }
  });
});
