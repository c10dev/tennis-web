// The game director (ADR-024, slice step 4): the chase camera all through live play, a close-up on the winner of a
// decisive point only, the side camera for changeovers; and the decision hold a UI can lay over any frame.
import { describe, expect, it } from 'vitest';
import { cameraAt, cameraTrack, heldShot, isDecisive } from '../src/broadcast/director.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { SAMPLE } from './fixtures.ts';

describe('game camera track', () => {
  for (const [n, r] of SAMPLE.slice(0, 3).entries()) {
    it(`is the chase at every point's start and never the TV main or serve camera (match ${n + 1})`, () => {
      const tl = buildTimeline(r);
      const track = cameraTrack(tl, { style: 'game' });
      expect(track.some((s) => s.camera === 'main' || s.camera === 'serve')).toBe(false);
      for (const seg of tl.segments) expect(cameraAt(track, seg.zero).camera).toBe('chase');
    });
  }

  it('cuts to a close-up on the winner after a decisive point and not after a plain winner', () => {
    let decisive = 0;
    let plain = 0;
    for (const r of SAMPLE) {
      const tl = buildTimeline(r);
      const track = cameraTrack(tl, { style: 'game' });
      for (const seg of tl.segments) {
        const shot = cameraAt(track, seg.landed + 0.3);
        if (isDecisive(seg)) {
          expect(shot).toEqual({ camera: 'closeup', focus: seg.point.winner });
          decisive++;
        } else if (seg.point.endedBy === 'winner' && seg.gap === 'point') {
          expect(shot.camera).toBe('chase');
          plain++;
        }
      }
    }
    expect(decisive).toBeGreaterThan(10);
    expect(plain).toBeGreaterThan(10);
  });
});

describe('decision hold', () => {
  const frame = { camera: 'chase' as const };
  it('shows the frame’s own camera without a hold, the held shot with one', () => {
    expect(heldShot(frame, null)).toEqual({ camera: 'chase' });
    expect(heldShot(frame, { camera: 'tell', focus: 'B' })).toEqual({ camera: 'tell', focus: 'B' });
    expect(heldShot({ camera: 'closeup', focus: 'A' }, null)).toEqual({ camera: 'closeup', focus: 'A' });
  });
});
