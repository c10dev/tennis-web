import { describe, expect, it } from 'vitest';
import { audioAction, parseSound, SOUND_KEY } from '../src/audio/policy.ts';
import { hapticFor } from '../src/lib/haptics.ts';

describe('sound setting (ADR-022)', () => {
  it('is on unless the player turned it off', () => {
    expect(SOUND_KEY).toBe('tennis-sound');
    expect(parseSound(null)).toBe(true);
    expect(parseSound('on')).toBe(true);
    expect(parseSound('off')).toBe(false);
    expect(parseSound('garbage')).toBe(true);
  });

  it('stops the sound when the game goes to the background and brings it back on return, only if it is on', () => {
    expect(audioAction(true, true)).toBe('suspend');
    expect(audioAction(false, true)).toBe('resume');
    expect(audioAction(true, false)).toBe('suspend');
    expect(audioAction(false, false)).toBe('none');
  });
});

describe('haptics', () => {
  it('taps on a pick, cheers a read, buzzes a misread, celebrates a win', () => {
    expect(hapticFor('pick')).toBe('tap');
    expect(hapticFor('read')).toBe('success');
    expect(hapticFor('misread')).toBe('error');
    expect(hapticFor('same')).toBe('tap');
    expect(hapticFor('win')).toBe('confetti');
    expect(hapticFor('loss')).toBe('basicMedium');
  });
});
