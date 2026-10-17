// Distance travelled (ADR-024, slice step 3): the stride is set by how far a player has moved, closed-form in time.
import { describe, expect, it } from 'vitest';
import { distanceAt, positionAt } from '../src/playback/movement.ts';
import { buildTimeline } from '../src/playback/timeline.ts';
import { match } from './fixtures.ts';

describe('distance travelled', () => {
  const tl = buildTimeline(match(2, 'clay'));
  for (const id of ['A', 'B'] as const) {
    it(`never goes back and matches the summed steps within 1% for ${id}`, () => {
      let walked = 0;
      let prev = positionAt(tl, id, 0);
      let last = distanceAt(tl, id, 0);
      expect(last).toBe(0);
      for (let t = 1 / 120; t < Math.min(tl.totalSec, 600); t += 1 / 120) {
        const p = positionAt(tl, id, t);
        walked += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
        const d = distanceAt(tl, id, t);
        expect(d, `${t}`).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
      expect(walked).toBeGreaterThan(100);
      expect(Math.abs(last - walked) / walked).toBeLessThan(0.01);
    });
  }
});
