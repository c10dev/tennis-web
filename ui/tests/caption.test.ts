import { describe, expect, it } from 'vitest';
import { captionAt, captionShown } from '../src/quick/caption.ts';

// Presentation spec E5 (TD-075): which caption the quick match shows at a match second, and how long it stays.
describe('captionAt', () => {
  // Two points: the toss at 0, the serve at 1, the end at 6, the next toss at 8.5; then 8.5, 9.5, 15, 17.5.
  const segments = [{ start: 0, zero: 1, end: 6, next: 8.5 }, { start: 8.5, zero: 9.5, end: 15, next: 17.5 }];
  const captions = [{ before: null, after: null }, { before: '매치 포인트', after: '상대 포핸드 위너' }];

  it('shows the lower-third from the toss until serveHoldSec after the serve', () => {
    expect(captionAt(segments, captions, 8.5)).toEqual({ key: 'before:1', kind: 'before', text: '매치 포인트' });
    expect(captionAt(segments, captions, 9.5 + 1.5)).toEqual({ key: 'before:1', kind: 'before', text: '매치 포인트' });
    expect(captionAt(segments, captions, 9.5 + 1.6)).toBeNull();
  });

  it('shows the result line from the point’s end through the walk back', () => {
    expect(captionAt(segments, captions, 14.9)).toBeNull();
    expect(captionAt(segments, captions, 15)).toEqual({ key: 'after:1', kind: 'after', text: '상대 포핸드 위너' });
    expect(captionAt(segments, captions, 30)).toEqual({ key: 'after:1', kind: 'after', text: '상대 포핸드 위너' });
  });

  it('shows nothing around a point that does not matter, or before the first toss', () => {
    expect(captionAt(segments, captions, 0.5)).toBeNull();
    expect(captionAt(segments, captions, 7)).toBeNull();
    expect(captionAt(segments, captions, -1)).toBeNull();
  });
});

describe('captionShown', () => {
  const up = { key: 'before:1', kind: 'before' as const, text: 'x', since: 10 };
  const next = { key: 'after:1', kind: 'after' as const, text: 'y' };

  it('replaces a caption at once with the next one', () => {
    expect(captionShown(up, next, 10.1)).toEqual({ ...next, since: 10.1 });
  });

  it('keeps a caption up for minSec of screen time before it goes', () => {
    expect(captionShown(up, null, 11.9)).toBe(up);
    expect(captionShown(up, null, 12)).toBeNull();
  });

  it('keeps the same caption without restarting its time', () => {
    expect(captionShown(up, { key: 'before:1', kind: 'before', text: 'x' }, 15)).toBe(up);
    expect(captionShown(null, null, 15)).toBeNull();
  });
});
