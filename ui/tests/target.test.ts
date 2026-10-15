import { describe, expect, it } from 'vitest';
import { entryFor, landingFor, routesFor, targetOf } from '../src/target.ts';

describe('build targets (ADR-022)', () => {
  it('builds for Toss only in the toss mode', () => {
    expect(targetOf('toss')).toBe('toss');
    for (const mode of ['development', 'production', 'test']) expect(targetOf(mode)).toBe('web');
  });

  it('opens the dev replay page from ?seed= on the web only', () => {
    expect(entryFor('web', '?seed=42&surface=clay')).toBe('replay');
    expect(entryFor('web', '')).toBe('game');
    expect(entryFor('toss', '?seed=42')).toBe('game');
    expect(entryFor('toss', '')).toBe('game');
  });

  it('ships the quick match only on Toss; the web keeps the season mode', () => {
    expect(routesFor('web')).toEqual(expect.arrayContaining(['', 'quick', 'new', 'saves', 'home', 'tournament', 'match']));
    expect(routesFor('toss')).toEqual(['quick']);
  });

  it('lands on the ladder on Toss, on the title on the web', () => {
    expect(landingFor('toss')).toBe('#/quick');
    expect(landingFor('web')).toBe('#/');
  });
});
