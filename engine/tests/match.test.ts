import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/match/stats.ts';
import { createConfig, simulateMatch } from '../src/match/simulateMatch.ts';
import { averagePlayer, bigServer } from '../src/player/presets.ts';
import { rightSign } from '../src/point/court.ts';
import { pointTags } from '../src/scoring/context.ts';
import { applyPoint, initialScoring } from '../src/scoring/match.ts';
import { SCHEMA_VERSION, type MatchConfig, type MatchEvent, type PointEvent } from '../src/types.ts';

const config = (o: Partial<MatchConfig> = {}): MatchConfig =>
  ({ ...createConfig([bigServer('Flint'), averagePlayer('Rook')]), ...o });
const pointsOf = (events: MatchEvent[]) => events.filter((e): e is PointEvent => e.type === 'point');

describe('simulateMatch', () => {
  const seeds = [1, 2, 3, 42, 99, 1234];
  const results = seeds.map((seed, i) => simulateMatch(config({ surface: (['hard', 'clay', 'grass'] as const)[i % 3]! }), seed));

  it('wraps the events with the schema version, seed and a copy of the config', () => {
    const c = config();
    const r = simulateMatch(c, 7);
    expect(r.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect(r.seed).toBe(7);
    expect(r.config).toEqual(c);
    expect(r.config).not.toBe(c);
  });

  it('starts with match_start and ends with match_end carrying the winner and stats', () => {
    for (const r of results) {
      expect(r.events[0]).toEqual({ type: 'match_start', seed: r.seed, surface: r.config.surface, players: ['Flint', 'Rook'], bestOf: 3 });
      const end = r.events.at(-1)!;
      expect(end).toMatchObject({ type: 'match_end', winner: r.winner, stats: r.stats });
      expect(r.events.filter((e) => e.type === 'match_end')).toHaveLength(1);
    }
  });

  it('agrees with the scoring state machine point by point', () => {
    for (const r of results) {
      let state = initialScoring(r.config.rules, r.config.firstServer);
      let i = 1;
      let index = 0;
      while (r.events[i]!.type === 'point') {
        const p = r.events[i] as PointEvent;
        expect(p.index).toBe(index++);
        expect(p.scoreBefore).toEqual(state.score);
        expect(p.server).toBe(state.score.server);
        expect(p.tags).toEqual(pointTags(state));
        const applied = applyPoint(state, p.winner);
        expect(p.scoreAfter).toEqual(applied.state.score);
        const between = r.events.slice(i + 1, i + 1 + applied.events.length);
        expect(between).toEqual(applied.events);
        state = applied.state;
        i += 1 + applied.events.length;
      }
      expect(state.winner).toBe(r.winner);
      expect(r.events[i]!.type).toBe('match_end');
    }
  });

  it('reports stats that match the point events', () => {
    for (const r of results) expect(r.stats).toEqual(computeStats(pointsOf(r.events)));
  });

  it('changes ends on changeovers and serves into the right court', () => {
    for (const r of results) {
      let sideOfA = -1;
      for (const e of r.events) {
        if (e.type === 'changeover') sideOfA = -sideOfA;
        if (e.type !== 'point') continue;
        const serve = e.shots[0]!;
        const serverSide = (serve.hitter === 'A' ? sideOfA : -sideOfA) as -1 | 1;
        expect(Math.sign(serve.hitterPos.y)).toBe(serverSide);
        const deuce = (e.scoreBefore.points[0] + e.scoreBefore.points[1]) % 2 === 0;
        expect(Math.sign(serve.from.x)).toBe(deuce ? rightSign(serverSide) : -rightSign(serverSide));
      }
    }
  });

  it('plays best of 5 to three sets', () => {
    const r = simulateMatch(config({ rules: { bestOf: 5, noAd: false, finalSet: 'advantage' } }), 5);
    const last = pointsOf(r.events).at(-1)!.scoreAfter;
    const won = last.sets.filter(([a, b]) => (r.winner === 'A' ? a > b : b > a)).length;
    expect(won).toBe(3);
  });

  it('is deterministic: same seed, same bytes; another seed, another match', () => {
    const a = JSON.stringify(simulateMatch(config(), 42));
    expect(JSON.stringify(simulateMatch(config(), 42))).toBe(a);
    expect(JSON.stringify(simulateMatch(config(), 43))).not.toBe(a);
  });

  it('survives a JSON round trip unchanged and does not mutate its input', () => {
    const c = config();
    const before = JSON.stringify(c);
    const r = simulateMatch(c, 11);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('rejects invalid configs', () => {
    expect(() => simulateMatch(config({ tactics: [{ ...config().tactics[0], aggression: 2 }, config().tactics[1]] }), 1)).toThrow(/aggression/);
    const bad = config();
    bad.players[0].attributes.forehand = 0;
    expect(() => simulateMatch(bad, 1)).toThrow(/forehand/);
  });
});

describe('computeStats', () => {
  it('counts aces, double faults, winners, errors, first serves and break points per player', () => {
    const r = simulateMatch(config(), 3);
    const pts = pointsOf(r.events);
    const s = r.stats;
    const by = (p: 'A' | 'B') => p === 'A' ? 0 : 1;
    const count = (f: (p: PointEvent) => boolean) => pts.filter(f).length;
    for (const p of ['A', 'B'] as const) {
      const other = p === 'A' ? 'B' : 'A';
      expect(s.aces[by(p)]).toBe(count((x) => x.endedBy === 'ace' && x.server === p));
      expect(s.doubleFaults[by(p)]).toBe(count((x) => x.endedBy === 'double_fault' && x.server === p));
      expect(s.winners[by(p)]).toBe(count((x) => x.endedBy === 'winner' && x.winner === p));
      expect(s.unforcedErrors[by(p)]).toBe(count((x) => x.endedBy === 'unforced_error' && x.winner === other));
      const served = count((x) => x.server === p);
      expect(s.firstServePct[by(p)]).toBeCloseTo(count((x) => x.server === p && x.serveNumber === 1) / served, 12);
      const chances = pts.filter((x) => x.server === other && x.tags.includes('break_point'));
      expect(s.breakPoints[by(p)]).toBe(`${chances.filter((x) => x.winner === p).length}/${chances.length}`);
    }
    expect(s.avgRally).toBeCloseTo(pts.reduce((a, x) => a + x.rallyLength, 0) / pts.length, 12);
  });
});
