import { describe, expect, it } from 'vitest';
import { averagePlayer, createConfig, SCHEMA_VERSION, simulateMatch, type PointEvent } from '@tennis/engine';
import { QUICK_PACE, showsImpact } from '@tennis/game';
import { buildProgramme, buildTimeline } from '@tennis/renderer';

// The game pace (TD-060) counts the impact moment's screen time without importing the renderer: check its rule and
// its seconds against the quick match's bare game-style programme.
describe('game pace against the renderer’s impact moment (ADR-024)', () => {
  const matches = Array.from({ length: 40 }, (_, seed) => {
    const config = createConfig([averagePlayer('A'), averagePlayer('B')], { rules: { bestOf: 1, noAd: true, finalSet: 'tiebreak7', setFormat: 'tiebreak' } });
    const result = simulateMatch(config, seed);
    const timeline = buildTimeline({ schemaVersion: SCHEMA_VERSION, config, events: result.events });
    const programme = buildProgramme(timeline, 'full', () => null, { intro: false, style: 'game' });
    return { points: result.events.filter((e): e is PointEvent => e.type === 'point'), programme };
  });

  it('splices the moment into the points `showsImpact` marks, never twice in a row', () => {
    let seen = 0;
    for (const { points, programme } of matches) {
      const spliced = new Set(programme.clips.filter((c) => c.kind === 'hitstop').map((c) => c.pointIndex));
      let previous = false;
      points.forEach((p, i) => {
        const impact: boolean = !previous && showsImpact(p);
        previous = impact;
        expect(spliced.has(i)).toBe(impact);
        if (impact) seen++;
      });
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('adds `impactSec` of screen time over the match time it covers', () => {
    const { programme } = matches.find((m) => m.programme.clips.some((c) => c.kind === 'hitstop'))!;
    const live = programme.clips.filter((c) => c.kind === 'live').reduce((a, c) => a + c.duration, 0);
    const moment = programme.clips.filter((c) => c.kind === 'slowmo' || c.kind === 'hitstop');
    const covered = moment.reduce((a, c) => a + c.duration * c.rate, 0);
    const extra = moment.reduce((a, c) => a + c.duration, 0) - covered;
    const moments = programme.clips.filter((c) => c.kind === 'hitstop').length;
    expect(extra / moments).toBeCloseTo(QUICK_PACE.game.impactSec, 6);
    expect(live + covered).toBeCloseTo(programme.timeline.totalSec, 6);
  });
});
