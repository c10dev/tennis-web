import { describe, expect, it } from 'vitest';
import { backAction } from '../src/lib/back.ts';

const at = (hash: string) => {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] ?? '', params: parts.slice(1) };
};

describe('the back button (ADR-022)', () => {
  it('closes an open dialog first, wherever it is', () => {
    for (const h of ['#/quick', '#/quick/match', '#/quick/result']) expect(backAction(at(h), true)).toBe('close-modal');
  });

  it('asks before conceding a match', () => {
    expect(backAction(at('#/quick/match'), false)).toBe('confirm-concede');
  });

  it('goes from the result to the ladder', () => {
    expect(backAction(at('#/quick/result'), false)).toBe('ladder');
  });

  it('asks before leaving the game from the ladder or the start form', () => {
    expect(backAction(at('#/quick'), false)).toBe('confirm-exit');
  });

  it('leaves other screens to the browser', () => {
    for (const h of ['#/', '#/home', '#/tournament']) expect(backAction(at(h), false)).toBe('none');
  });
});
