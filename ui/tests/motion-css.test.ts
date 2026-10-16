/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Motion lives in motion.css only (ADR-021, TD-046): the screen CSS of the quick match and result holds layout and
// colour, so an import reorder in screens.ts cannot bring back an old animation.
// Read from disk: Vitest turns CSS imports, even ?raw, into empty strings.
const css = (file: string) => readFileSync(new URL(`../src/quick/${file}`, import.meta.url), 'utf8');

describe('quick screen CSS', () => {
  it.each(['quick-match.css', 'quick-result.css'])('%s has no animation, keyframes or transition', (file) => {
    expect(css(file)).not.toMatch(/@keyframes|\banimation\s*:|\btransition\s*:/);
  });

  it('motion.css still animates the rating bars that the result screen grows', () => {
    expect(css('motion.css')).toMatch(/\.rating-gain \.fill\s*\{[^}]*transition:[^}]*width/);
  });
});
