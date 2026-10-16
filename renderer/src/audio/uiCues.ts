// Quick-screen UI sounds as data (ADR-029, TD-047): each cue is a few tone and noise voices, plus a crowd duck for the
// face-down hold. The mixer only plays what this returns, so the sounds can be tested without Web Audio.
import { AUDIO } from '../tuning/audio.ts';

export type UiCue =
  | { kind: 'deal'; i: number }
  | { kind: 'pick' }
  | { kind: 'hold' }
  | { kind: 'flip' }
  | { kind: 'clash'; matchup: 'won' | 'lost' | 'even' }
  | { kind: 'tick'; i: number; n: number; down: boolean }
  | { kind: 'rise' }
  | { kind: 'stamp' };

interface Envelope { delay: number; attack: number; decay: number; peak: number }
export type Voice =
  | (Envelope & { type: 'tone'; wave: 'sine' | 'triangle' | 'square'; freq: number; endFreq: number })
  | (Envelope & { type: 'noise'; filter: 'bandpass' | 'lowpass' | 'highpass'; freq: number; q: number });

export interface UiSound {
  voices: Voice[];
  duck?: { bus: 'crowd'; level: number; sec: number };
}

const U = AUDIO.ui;
const semis = (freq: number, n: number) => freq * 2 ** (n / 12);
const tone = (freq: number, peak: number, decay: number, o: Partial<Envelope> & { wave?: 'sine' | 'triangle' | 'square'; endFreq?: number } = {}): Voice =>
  ({ type: 'tone', wave: o.wave ?? 'triangle', freq, endFreq: o.endFreq ?? freq, delay: o.delay ?? 0, attack: o.attack ?? 0.004, decay, peak });
const noise = (filter: 'bandpass' | 'lowpass' | 'highpass', freq: number, q: number, peak: number, decay: number, delay = 0): Voice =>
  ({ type: 'noise', filter, freq, q, delay, attack: 0.004, decay, peak });

/** When a voice has died away, from the cue's start. */
export const voiceEnd = (v: Voice): number => v.delay + v.attack + v.decay;

/** Pitch of count-up tick `i` of `n`: from the base note up to an octave by the end (down a fifth for a loss), in semitones. */
export function tickFreq(i: number, n: number, down: boolean): number {
  const f = n <= 1 ? 0 : Math.min(1, Math.max(0, i / (n - 1)));
  const steps = Math.round(f * (down ? U.tick.downSemitones : U.tick.maxSemitones));
  return semis(U.tick.base, down ? -steps : steps);
}

export function uiSound(cue: UiCue): UiSound {
  switch (cue.kind) {
    case 'deal':
      return { voices: [tone(semis(U.deal.freq, cue.i * U.deal.stepSemitones), U.deal.peak, U.deal.decay)] };
    case 'pick':
      return { voices: [tone(U.pick.freq, U.pick.peak, U.pick.decay, { endFreq: U.pick.freq * 1.5 })] };
    case 'hold':
      return { voices: [tone(U.hold.freq, U.hold.peak, U.hold.decay, { wave: 'sine', attack: 0.05 })], duck: { bus: 'crowd', level: U.hold.duck, sec: U.hold.sec } };
    case 'flip':
      return { voices: [noise('bandpass', U.flip.freq, U.flip.q, U.flip.peak, U.flip.decay)] };
    case 'clash': {
      const c = U.clash;
      const chord = c[cue.matchup].map((f, k) => tone(f, c.peak, c.decay, { delay: 0.02 + k * c.stepSec }));
      return { voices: [noise('lowpass', c.thump.freq, c.thump.q, c.thump.peak, c.thump.decay), ...chord] };
    }
    case 'tick':
      return { voices: [tone(tickFreq(cue.i, cue.n, cue.down), U.tick.peak, U.tick.decay, { wave: 'square' })] };
    case 'rise':
      return { voices: U.rise.notes.map((f, k) => tone(f, U.rise.peak, U.rise.decay, { delay: k * U.rise.stepSec })) };
    case 'stamp':
      return { voices: [tone(U.stamp.freq, U.stamp.peak, U.stamp.decay, { wave: 'sine', endFreq: U.stamp.freq * 0.5 }),
        noise('bandpass', U.stamp.noise.freq, U.stamp.noise.q, U.stamp.noise.peak, U.stamp.noise.decay)] };
  }
}
