// Generated samples (TD-016, ADR-027): the set docs/sound/manifest.json orders, where the files are, and which ones a
// cue plays at what rate and gain. Pure; bank.ts loads the files and the mixer plays them, falling back to synthesis
// for any sample that has not loaded.
import { AUDIO } from '../tuning/index.ts';
import type { Cue } from './cues.ts';

export const SAMPLE_IDS = [
  'hit-flat', 'hit-heavy', 'hit-slice', 'bounce-hard', 'bounce-clay', 'net',
  'applause-small', 'applause-big', 'cheer', 'crowd-bed', 'sting-win', 'sting-lose',
] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];
export type SampleFormat = 'ogg' | 'm4a';

/** One sample to play: rate 1 is as recorded (pitch follows rate), gain 0–1. */
export interface SamplePlay {
  id: SampleId;
  rate: number;
  gain: number;
}

export const sampleUrl = (base: string, id: SampleId, ext: SampleFormat): string => `${base}${id}.${ext}`;

/** Opus where the browser will play it, else AAC (older iOS WebKit); `canPlay` is `HTMLMediaElement.canPlayType`. */
export const sampleFormat = (canPlay: (type: string) => string): SampleFormat =>
  canPlay('audio/ogg; codecs="opus"') !== '' ? 'ogg' : 'm4a';

/** Where the crowd bed loops, inside both ends of a file `duration` seconds long. */
export const loopEdges = (duration: number): { start: number; end: number } => ({
  start: AUDIO.samples.loopInsetSec,
  end: duration - AUDIO.samples.loopInsetSec,
});

/** A repeatable 0–1 value from the cue's time, so the same cue always plays the same way. */
function jitterOf(at: number): number {
  let x = Math.imul(Math.round(at * 1000) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
}

const HEAVY = new Set(['serve', 'overhead']);
const TOUCH = new Set(['slice', 'drop', 'lob']);

/** The samples a cue plays; empty for the umpire, who stays on speech synthesis. */
export function samplesFor(cue: Cue): SamplePlay[] {
  const S = AUDIO.samples;
  const soft = 'replay' in cue && cue.replay ? S.replayGain : 1;
  switch (cue.kind) {
    case 'hit': {
      const power = Math.min(1, cue.speedKmh / S.fullPowerKmh);
      const id: SampleId = HEAVY.has(cue.shot) ? 'hit-heavy' : TOUCH.has(cue.shot) ? 'hit-slice' : 'hit-flat';
      const rate = 1 + S.rateSpread * (power - 0.5) + S.jitter * (2 * jitterOf(cue.at) - 1);
      return [{ id, rate, gain: soft * (0.5 + 0.5 * power) }];
    }
    case 'bounce':
      if (cue.surface === 'clay') return [{ id: 'bounce-clay', rate: 1, gain: soft }];
      if (cue.surface === 'grass') return [{ id: 'bounce-hard', rate: S.grassRate, gain: soft * S.grassGain }];
      return [{ id: 'bounce-hard', rate: 1, gain: soft }];
    case 'net':
      return [{ id: 'net', rate: 1, gain: soft }];
    case 'crowd': {
      const gain = 0.4 + 0.6 * cue.intensity;
      if (cue.intensity < S.bigApplauseAt) return [{ id: 'applause-small', rate: 1, gain }];
      const out: SamplePlay[] = [{ id: 'applause-big', rate: 1, gain }];
      if (cue.intensity >= S.cheerAt) out.push({ id: 'cheer', rate: 1, gain });
      return out;
    }
    case 'call':
      return [];
  }
}
