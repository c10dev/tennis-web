import { describe, expect, it } from 'vitest';
import { advance, finish, isOver, replayMatch, setTactic, startMatch } from '../src/match/live.ts';
import { createConfig, DEFAULT_TACTIC, simulateMatch } from '../src/match/simulateMatch.ts';
import { exhibitionConfig } from '../src/match/exhibition.ts';
import { averagePlayer } from '../src/player/presets.ts';
import { SCHEMA_VERSION, type MatchConfig, type MatchEvent, type MatchRecipe, type PointEvent, type Tactic } from '../src/types.ts';

const AGGRESSIVE: Tactic = { ...DEFAULT_TACTIC, aggression: 1 };
const configs: [MatchConfig, number][] = [
  [exhibitionConfig('clay'), 42],
  [exhibitionConfig('grass'), 7],
  [createConfig([averagePlayer('Ann'), averagePlayer('Bea')], { rules: { bestOf: 5, noAd: true, finalSet: 'tiebreak10' } }), 3],
];

describe('live match API', () => {
  it('plays a whole match exactly as simulateMatch does', () => {
    for (const [config, seed] of configs) {
      const live = startMatch(config, seed);
      advance(live, 'match');
      expect(JSON.stringify(finish(live))).toBe(JSON.stringify(simulateMatch(config, seed)));
    }
  });

  it('stops after every set and resumes where it stopped', () => {
    for (const [config, seed] of configs) {
      const live = startMatch(config, seed);
      const chunks: MatchEvent[][] = [];
      while (!isOver(live)) chunks.push(advance(live, 'set'));
      for (const chunk of chunks.slice(0, -1)) expect(chunk.some((e) => e.type === 'set_end')).toBe(true);
      expect(chunks.at(-1)!.at(-1)!.type).toBe('match_end');
      expect([simulateMatch(config, seed).events[0], ...chunks.flat()]).toEqual(simulateMatch(config, seed).events);
    }
  });

  it('changes tactics only between sets, recording a tactic_change event', () => {
    const live = startMatch(exhibitionConfig('hard'), 5);
    expect(() => setTactic(live, 'A', AGGRESSIVE)).toThrow(/between sets/);
    advance(live, 'set');
    setTactic(live, 'A', AGGRESSIVE);
    expect(live.events.at(-1)).toEqual({ type: 'tactic_change', player: 'A', tactic: AGGRESSIVE });
    expect(() => setTactic(live, 'B', { ...DEFAULT_TACTIC, aggression: 3 })).toThrow(/aggression/);
    advance(live, 'match');
    expect(() => setTactic(live, 'B', AGGRESSIVE)).toThrow(/between sets/);
    expect(() => advance(live, 'set')).toThrow(/over/);
  });

  it('serves where the new tactic says once it is set', () => {
    const live = startMatch(exhibitionConfig('hard'), 9);
    advance(live, 'set');
    setTactic(live, 'A', { ...DEFAULT_TACTIC, serveTarget: 't' });
    const later = advance(live, 'match').filter((e): e is PointEvent => e.type === 'point' && e.server === 'A');
    const goodServes = later.flatMap((p) => p.shots.filter((s) => s.shot === 'serve' && s.outcome !== 'fault' && s.outcome !== 'double_fault'));
    expect(goodServes.length).toBeGreaterThan(10);
    for (const s of goodServes) expect(Math.abs(s.bounce!.x)).toBeLessThanOrEqual(1);
  });

  it('replays a recipe of seed, config and tactic changes exactly, also from JSON', () => {
    const recipe: MatchRecipe = { config: exhibitionConfig('clay'), seed: 11, tacticChanges: [{ afterSet: 1, player: 'B', tactic: AGGRESSIVE }] };
    const live = startMatch(recipe.config, recipe.seed);
    advance(live, 'set');
    setTactic(live, 'B', AGGRESSIVE);
    advance(live, 'match');
    const direct = finish(live);
    expect(replayMatch(recipe)).toEqual(direct);
    expect(replayMatch(JSON.parse(JSON.stringify(recipe)) as MatchRecipe)).toEqual(direct);
    expect(replayMatch({ ...recipe, tacticChanges: [] })).toEqual(simulateMatch(recipe.config, recipe.seed));
  });

  it('makes an aggressive player hit more winners and more errors', () => {
    const rate = (aggression: number) => {
      let shots = 0;
      let points = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const r = replayMatch({
          config: createConfig([averagePlayer('Ann'), averagePlayer('Bea')]), seed,
          tacticChanges: [{ afterSet: 1, player: 'A', tactic: { ...DEFAULT_TACTIC, aggression } }],
        });
        const after = r.events.filter((e): e is PointEvent => e.type === 'point' && e.scoreBefore.sets.length >= 1);
        points += after.length;
        shots += after.filter((p) => p.shots.at(-1)!.hitter === 'A' && ['winner', 'unforced_error'].includes(p.endedBy)).length;
      }
      return shots / points;
    };
    expect(rate(1)).toBeGreaterThan(rate(0) * 1.15);
  });

  it('starts tired players tired: fatigue going in lowers the win rate', () => {
    const wins = (fatigue: number) => {
      let a = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const config = { ...createConfig([averagePlayer('Ann'), averagePlayer('Bea')]), condition: { fatigue: [fatigue, 0] as [number, number] } };
        if (simulateMatch(config, seed).winner === 'A') a++;
      }
      return a / 400;
    };
    expect(wins(0.8)).toBeLessThan(wins(0) - 0.05);
    const bad = { ...createConfig([averagePlayer('Ann'), averagePlayer('Bea')]), condition: { fatigue: [1.5, 0] as [number, number] } };
    expect(() => simulateMatch(bad, 1)).toThrow(/fatigue/);
  });

  it('writes schema version 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });
});
