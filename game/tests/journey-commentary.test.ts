import { describe, expect, it } from 'vitest';
import { createConfig, ratedPlayer, simulateMatch } from '@tennis/engine';
import { commentary } from '../src/journey/commentary.ts';

describe('journey commentary', () => {
  const config = createConfig([ratedPlayer('박서브', 14), ratedPlayer('잭 스톤웰', 14)], { rules: { bestOf: 5, noAd: false, finalSet: 'tiebreak7' } });
  const recipe = { config, seed: 11, tacticChanges: [] };
  const lines = commentary(recipe, '런던 메이저 결승');
  const result = simulateMatch(config, 11);

  it('tells the match from the heading to the numbers, ending with the right winner and score', () => {
    expect(lines[0]).toEqual({ kind: 'title', text: '런던 메이저 결승' });
    const end = lines.find((l) => l.kind === 'end')!;
    expect(end.ours).toBe(result.winner === 'A');
    const last = result.events.at(-1)!;
    if (last.type !== 'match_end') throw new Error('no end');
    expect(end.text).toContain(last.score.sets.map(([a, b]) => `${a}-${b}`).join(' '));
    expect(lines.at(-1)!.kind).toBe('stats');
  });

  it('has a line per game and a sentence for each break, set and match point', () => {
    const games = result.events.filter((e) => e.type === 'game_end').length;
    expect(lines.filter((l) => l.kind === 'game' || l.kind === 'break').length).toBe(games);
    const keys = result.events.filter((e) => e.type === 'point' && e.tags.some((t) => t !== 'tiebreak')).length;
    expect(lines.filter((l) => l.kind === 'key').length).toBe(keys);
    expect(lines.filter((l) => l.kind === 'set').length).toBe(lines.filter((l) => l.kind === 'set-end').length);
    for (const l of lines) expect(l.text).not.toMatch(/undefined|NaN/);
  });
});
