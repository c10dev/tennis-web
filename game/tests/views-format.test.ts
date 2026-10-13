import { describe, expect, it } from 'vitest';
import { STYLE_BLURB } from '../src/views/format.ts';

// The start form explains each style in one line, naming the card it plays best (engine CARDS.style).
describe('STYLE_BLURB', () => {
  it('describes every style a player can create, naming its favoured card', () => {
    expect(Object.keys(STYLE_BLURB).sort()).toEqual(['all_court', 'baseliner', 'big_server', 'counter_puncher']);
    expect(STYLE_BLURB.big_server).toContain('Attack');
    expect(STYLE_BLURB.baseliner).toContain('Defend');
    expect(STYLE_BLURB.counter_puncher).toContain('Counter');
    for (const line of Object.values(STYLE_BLURB)) expect(line.length).toBeLessThan(90);
  });
});
