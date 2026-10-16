import { describe, expect, it } from 'vitest';
import { insetVars } from '../src/lib/safe-area.ts';

describe('safe-area tokens (ADR-022)', () => {
  it('turns the platform insets into the CSS tokens, rounded to whole pixels', () => {
    expect(insetVars({ top: 47.3, right: 0, bottom: 34, left: 0 })).toEqual({
      '--safe-top': '47px', '--safe-right': '0px', '--safe-bottom': '34px', '--safe-left': '0px',
    });
  });

  it('never sets a negative inset', () => {
    expect(insetVars({ top: -2, right: 0, bottom: 0, left: 0 })['--safe-top']).toBe('0px');
  });
});
