import { describe, expect, it } from 'vitest';
import {
  averagePlayer, createConfig, exhibitionConfig, fingerprint, simulateMatch, type MatchEvent, type MatchResult, type ShotEvent, type Surface,
} from '../src/index.ts';

// Presentation geometry (positions, bounces, times) may change; nothing drawn from the RNG for the result may.
// Speed, spin and net clearance stay in the hash: they come from the same RNG stream as the outcomes, so keeping
// them identical proves every draw still lines up (ADR-008).
const GEOMETRY = new Set<keyof ShotEvent | 'durationSec'>(['t', 'flightSec', 'from', 'bounce', 'hitterPos', 'receiverPos', 'durationSec']);

function strip(e: MatchEvent): unknown {
  if (e.type !== 'point') return e;
  const point = Object.fromEntries(Object.entries(e).filter(([k]) => !GEOMETRY.has(k as never)));
  return { ...point, shots: e.shots.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !GEOMETRY.has(k as never)))) };
}

const outcomeFingerprint = (r: MatchResult) => fingerprint({ ...r, events: r.events.map(strip) as MatchEvent[] });

const SURFACES: Surface[] = ['hard', 'clay', 'grass'];
const matches = SURFACES.flatMap((surface) => [1, 2, 3, 4].flatMap((seed) => [
  simulateMatch(exhibitionConfig(surface), seed),
  simulateMatch(createConfig([averagePlayer('Ann'), averagePlayer('Bea')], { surface, rules: { bestOf: 5, noAd: true, finalSet: 'tiebreak10' } }), seed),
]));

describe('outcome golden (results must not depend on presentation geometry)', () => {
  it('keeps every outcome, score, tag, stat, speed, spin and net clearance of 24 matches', () => {
    expect(fingerprint({ events: matches.map(outcomeFingerprint) } as unknown as MatchResult)).toBe('72692611');
  });

  it('keeps the winners', () => {
    expect(matches.map((m) => m.winner).join('')).toBe('ABBAABABABAAAAAABABAAABB');
  });
});
