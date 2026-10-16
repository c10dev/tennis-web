import { describe, expect, it } from 'vitest';
import { clipStep, MAX_FRAME_SEC } from '../src/replay/clip.ts';

// A quick-match clip's clock (TD-037): the first frame of a window shows its start, however long that frame took.
describe('clipStep', () => {
  it('does not advance on the first frame of a window, even after a long stall', () => {
    expect(clipStep(10, 18, 0.42, 2, true)).toBe(10);
  });

  it('then advances by real time × speed, a stalled frame counting at most MAX_FRAME_SEC', () => {
    expect(clipStep(10, 18, 0.016, 2, false)).toBeCloseTo(10.032, 9);
    expect(clipStep(10, 18, 3, 2, false)).toBeCloseTo(10 + MAX_FRAME_SEC * 2, 9);
  });

  it('stops at the end of the window', () => {
    expect(clipStep(17.99, 18, 0.1, 2, false)).toBe(18);
  });
});
