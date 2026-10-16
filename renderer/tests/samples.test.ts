import { describe, expect, it } from 'vitest';
import type { Cue } from '../src/audio/cues.ts';
import { loopEdges, sampleFormat, samplesFor, sampleUrl, SAMPLE_IDS } from '../src/audio/samples.ts';
import { AUDIO } from '../src/tuning/index.ts';

const hit = (shot: Extract<Cue, { kind: 'hit' }>['shot'], speedKmh = 120, at = 1, replay = false): Cue => ({ kind: 'hit', shot, speedKmh, replay, at });
// The renderer's tests have no Node types (the package is browser code); fs comes in untyped.
const FS = 'node:fs';
const fs = (await import(FS)) as { readFileSync(path: URL, enc: 'utf8'): string };

const ids = (cue: Cue) => samplesFor(cue).map((s) => s.id);

describe('sample set (TD-016)', () => {
  it('is the set docs/sound/manifest.json orders, minus nothing and plus nothing', () => {
    const manifest = JSON.parse(fs.readFileSync(new URL('../../docs/sound/manifest.json', import.meta.url), 'utf8')) as { sounds: { id: string }[] };
    expect([...SAMPLE_IDS].sort()).toEqual(manifest.sounds.map((s) => s.id).sort());
  });

  it('names files by id and format under the base', () => {
    expect(sampleUrl('./audio/', 'hit-flat', 'ogg')).toBe('./audio/hit-flat.ogg');
  });

  it('prefers Opus and falls back to AAC where Opus will not play', () => {
    expect(sampleFormat((t) => (t.includes('opus') ? 'probably' : ''))).toBe('ogg');
    expect(sampleFormat((t) => (t.includes('mp4') ? 'maybe' : ''))).toBe('m4a');
    expect(sampleFormat(() => '')).toBe('m4a');
  });

  it('loops the crowd bed inside its edges, away from codec padding', () => {
    const { start, end } = loopEdges(7);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeLessThan(7);
    expect(end - start).toBeGreaterThan(6.5);
  });
});

describe('samplesFor', () => {
  it('picks the heavy hit for serves and overheads, the slice for touch shots, the flat hit otherwise', () => {
    expect(ids(hit('serve'))).toEqual(['hit-heavy']);
    expect(ids(hit('overhead'))).toEqual(['hit-heavy']);
    for (const s of ['slice', 'drop', 'lob'] as const) expect(ids(hit(s))).toEqual(['hit-slice']);
    for (const s of ['drive', 'return', 'volley', 'approach'] as const) expect(ids(hit(s))).toEqual(['hit-flat']);
  });

  it('hits harder, louder and a little higher with ball speed', () => {
    const [slow] = samplesFor(hit('drive', 60));
    const [fast] = samplesFor(hit('drive', 190));
    expect(fast!.gain).toBeGreaterThan(slow!.gain);
    expect(fast!.rate).toBeGreaterThan(slow!.rate);
  });

  it('varies a little from shot to shot but plays the same cue the same way every time', () => {
    const a = samplesFor(hit('drive', 120, 1.0));
    const b = samplesFor(hit('drive', 120, 2.37));
    expect(samplesFor(hit('drive', 120, 1.0))).toEqual(a);
    expect(a[0]!.rate).not.toBe(b[0]!.rate);
    for (const s of [a[0]!, b[0]!]) expect(Math.abs(s.rate - 1)).toBeLessThan(0.15);
  });

  it('plays replays softer', () => {
    expect(samplesFor(hit('drive', 120, 1, true))[0]!.gain).toBeLessThan(samplesFor(hit('drive', 120, 1))[0]!.gain);
  });

  it('bounces by surface: clay its own, grass a lower, softer hard-court bounce', () => {
    const b = (surface: 'hard' | 'clay' | 'grass') => samplesFor({ kind: 'bounce', surface, replay: false, at: 1 })[0]!;
    expect(b('clay').id).toBe('bounce-clay');
    expect(b('hard').id).toBe('bounce-hard');
    expect(b('grass').id).toBe('bounce-hard');
    expect(b('grass').rate).toBeLessThan(b('hard').rate);
    expect(b('grass').gain).toBeLessThan(b('hard').gain);
  });

  it('plays the net sample for a ball in the net', () => {
    expect(ids({ kind: 'net', replay: false, at: 1 })).toEqual(['net']);
  });

  it('claps politely for a small moment, loudly for a big one, and cheers on top for the biggest', () => {
    const c = (intensity: number) => ({ kind: 'crowd', intensity, at: 1 }) as const;
    expect(ids(c(0.2))).toEqual(['applause-small']);
    expect(ids(c(AUDIO.samples.bigApplauseAt))).toEqual(['applause-big']);
    expect(ids(c(AUDIO.samples.cheerAt))).toEqual(['applause-big', 'cheer']);
    expect(samplesFor(c(0.9))[0]!.gain).toBeGreaterThan(samplesFor(c(0.6))[0]!.gain);
  });

  it('leaves the umpire to speech synthesis', () => {
    expect(samplesFor({ kind: 'call', text: 'Out', at: 1 })).toEqual([]);
  });
});
