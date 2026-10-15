import { describe, expect, it } from 'vitest';
import { langFor, uiText } from '../src/i18n/index.ts';

/** Key paths of a catalog, so the two languages can be compared. */
const shape = (x: object): string[] => Object.entries(x).map(([k, v]) => `${k}:${typeof v}`).sort();

describe('UI language (ADR-022)', () => {
  it('is Korean in the Toss build, English on the web unless ?lang=ko', () => {
    expect(langFor('toss', '')).toBe('ko');
    expect(langFor('toss', '?lang=en')).toBe('ko');
    expect(langFor('web', '')).toBe('en');
    expect(langFor('web', '?lang=ko')).toBe('ko');
    expect(langFor('web', '?seed=1&lang=ko')).toBe('ko');
    expect(langFor('web', '?lang=fr')).toBe('en');
  });

  it('has every UI string in both languages', () => {
    expect(shape(uiText('ko'))).toEqual(shape(uiText('en')));
  });

  it('says the ladder lines in Korean', () => {
    const ko = uiText('ko');
    expect(ko.toNext(12, 7)).toBe('7위까지 12점');
    expect(ko.recentRow(true, 'Kim', '7-5', 18)).toBe('승 · Kim · 7-5 · +18');
    expect(ko.recentRow(false, 'Kim', '3-7', -6)).toBe('패 · Kim · 3-7 · -6');
    expect(uiText('en').recentRow(false, 'Kim', '3-7', -6)).toBe('L · Kim · 3-7 · -6');
  });
});
