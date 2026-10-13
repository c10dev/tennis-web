import { describe, expect, it } from 'vitest';
import { COURT, exhibitionConfig, fingerprint, simulateMatch, type MatchResult } from '../src/index.ts';

describe('fingerprint', () => {
  const clay42 = simulateMatch(exhibitionConfig('clay'), 42);

  it('is a stable 8-digit hex hash of the events (golden value, also checked in the browser: TD-005)', () => {
    expect(fingerprint(clay42)).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprint(clay42)).toBe('d351eb07');
  });

  it('changes with the seed and the surface', () => {
    expect(fingerprint(simulateMatch(exhibitionConfig('clay'), 43))).not.toBe(fingerprint(clay42));
    expect(fingerprint(simulateMatch(exhibitionConfig('hard'), 42))).not.toBe(fingerprint(clay42));
  });

  it('survives a JSON round trip, so a saved replay keeps its fingerprint', () => {
    expect(fingerprint(JSON.parse(JSON.stringify(clay42)) as MatchResult)).toBe(fingerprint(clay42));
  });

  it('hashes the standard FNV-1a test vectors', () => {
    const events = (s: string) => ({ events: s }) as unknown as MatchResult;
    // JSON.stringify of a string adds quotes: fnv1a('""') and fnv1a('"a"').
    expect(fingerprint(events(''))).toBe(fnv1a('""'));
    expect(fingerprint(events('a'))).toBe(fnv1a('"a"'));
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
  });
});

describe('exhibitionConfig', () => {
  it('is the big server Flint against the average Rook on the chosen surface, shared by the CLI and the replay page', () => {
    const c = exhibitionConfig('grass');
    expect(c.surface).toBe('grass');
    expect(c.players.map((p) => p.name)).toEqual(['Flint', 'Rook']);
    expect(c.players[0].style).toBe('big_server');
  });

  it('exports the court dimensions the renderer draws', () => {
    expect(COURT).toEqual({ halfLength: 11.885, halfWidth: 4.115, serviceLine: 6.4 });
  });
});

/** Reference FNV-1a 32-bit over UTF-16 code units, written independently of the engine's version. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
