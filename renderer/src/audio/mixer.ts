// The mixer (GDD §8.4, ADR-027, ADR-029): plays the cues of cues.ts and the screen sounds of uiCues.ts. Ball and crowd
// play the generated samples once loadSamples() has them (TD-016) and are synthesised until then, or for any sample
// that failed; the result's stinger plays its sample the same way. Browser-only and not unit-tested; cues.ts, uiCues.ts
// and samples.ts decide what plays and when. Reached through the `@tennis/renderer/audio` entry: no Three.js here.
import { AUDIO } from '../tuning/audio.ts';
import { createBank, type SampleState } from './bank.ts';
import type { Cue } from './cues.ts';
import { loopEdges, samplesFor, type SampleId } from './samples.ts';
import { createSynth, noiseBuffer } from './synth.ts';
import { uiSound, type UiCue, type Voice } from './uiCues.ts';
import { createVoice } from './voice.ts';

export type { SampleState } from './bank.ts';

export type Bus = 'master' | 'sfx' | 'crowd' | 'umpire' | 'ui';

export interface Mixer {
  play(cue: Cue): void;
  /** A quick-screen UI sound; the face-down hold also ducks the crowd. */
  playUi(cue: UiCue): void;
  /** Drops `bus` to `level` of its volume for `sec`, then brings it back. */
  duck(bus: Bus, level: number, sec: number): void;
  /** The crowd murmur under everything: on for matches, off on menus. */
  setBed(on: boolean): void;
  /** Fetches and decodes the samples from `base` (ending in '/'); once only. Until then, and for any that fail, synthesis. */
  loadSamples(base: string): Promise<SampleState>;
  readonly samples: SampleState;
  setVolume(bus: Bus, value: number): void;
  volume(bus: Bus): number;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** Stops all audio at once (the page went to the background); resume() brings it back. */
  suspend(): Promise<void>;
  resume(): Promise<void>;
  /** The audio context's state: 'running', 'suspended' (or 'closed' after dispose). */
  readonly state: AudioContextState;
  dispose(): void;
}

const CROWD_SAMPLES = new Set<SampleId>(['applause-small', 'applause-big', 'cheer', 'crowd-bed']);

/** Must be created from a user gesture (autoplay policy). */
export function createMixer(): Mixer {
  const ctx = new AudioContext();
  const volumes: Record<Bus, number> = { ...AUDIO.volume };
  const gains = {} as Record<Bus, GainNode>;
  for (const bus of ['master', 'sfx', 'crowd', 'umpire', 'ui'] as const) {
    gains[bus] = ctx.createGain();
    gains[bus].gain.value = volumes[bus];
    if (bus !== 'master') gains[bus].connect(gains.master);
  }
  gains.master.connect(ctx.destination);
  const noise = noiseBuffer(ctx, 2);
  const synth = createSynth(ctx, noise);
  const bank = createBank(ctx);
  const voice = createVoice();
  let muted = false;
  let bedSwapped = false;

  // The crowd murmur: on in matches, off on menus (setBed). Filtered noise until the crowd-bed sample takes over.
  const bedLevel = 0.12;
  const bedBus = ctx.createGain();
  bedBus.connect(gains.crowd);
  const bed = ctx.createBufferSource();
  bed.buffer = noise;
  bed.loop = true;
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = 500;
  const bedGain = ctx.createGain();
  bedGain.gain.value = bedLevel;
  bed.connect(bedFilter).connect(bedGain).connect(bedBus);
  bed.start();

  const sampleBed = (buffer: AudioBuffer) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const { start, end } = loopEdges(buffer.duration);
    src.loopStart = start;
    src.loopEnd = end;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const fade = AUDIO.samples.bedFadeSec;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + fade);
    bedGain.gain.setValueAtTime(bedGain.gain.value, t);
    bedGain.gain.linearRampToValueAtTime(0, t + fade);
    bed.stop(t + fade + 0.05);
    src.connect(gain).connect(bedBus);
    src.start(t, start);
  };

  const playSample = (id: SampleId, rate: number, gain: number, out?: GainNode): boolean => {
    const buffer = bank.get(id);
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(env).connect(out ?? (CROWD_SAMPLES.has(id) ? gains.crowd : gains.sfx));
    src.start();
    return true;
  };

  /** The synthesised cue, as before samples (and for any sample that did not load). */
  const synthCue = (cue: Cue) => {
    const soft = 'replay' in cue && cue.replay ? 0.6 : 1;
    switch (cue.kind) {
      case 'hit': {
        const power = Math.min(1, cue.speedKmh / 200);
        synth.burst(gains.sfx, 'bandpass', 1800 + 1400 * power, 1.2, 0.6 * soft * (0.5 + power), 0.002, 0.05);
        synth.tone(gains.sfx, cue.shot === 'serve' ? 520 : 440, 0.35 * soft, 0.06);
        break;
      }
      case 'bounce':
        synth.burst(gains.sfx, 'lowpass', cue.surface === 'clay' ? 500 : cue.surface === 'grass' ? 650 : 900, 0.7, 0.35 * soft, 0.002, 0.07);
        break;
      case 'net':
        synth.burst(gains.sfx, 'lowpass', 300, 0.7, 0.4 * soft, 0.005, 0.18);
        break;
      case 'crowd':
        // Applause: a swell of bright noise whose loudness and length follow the moment.
        synth.burst(gains.crowd, 'bandpass', 2500, 0.4, 0.15 + 0.65 * cue.intensity, 0.25, 1 + 2.5 * cue.intensity);
        break;
      case 'call':
        break;
    }
  };

  /** One UI voice on the ui bus, `v.delay` from now. */
  const uiVoice = (v: Voice) => {
    const t = ctx.currentTime + v.delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(v.peak, t + v.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + v.attack + v.decay);
    env.connect(gains.ui);
    const end = t + v.attack + v.decay + 0.02;
    if (v.type === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.freq, t);
      if (v.endFreq !== v.freq) osc.frequency.exponentialRampToValueAtTime(v.endFreq, end);
      osc.connect(env);
      osc.start(t);
      osc.stop(end);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = v.filter;
      filter.frequency.value = v.freq;
      filter.Q.value = v.q;
      src.connect(filter).connect(env);
      src.start(t, Math.random());
      src.stop(end);
    }
  };
  const duck = (bus: Bus, level: number, sec: number) => {
    const g = gains[bus].gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(volumes[bus] * level, t, 0.04);
    g.setTargetAtTime(volumes[bus], t + sec, 0.12);
  };

  return {
    play(cue) {
      if (muted) return;
      if (cue.kind === 'call') {
        voice.say(cue.text, volumes.umpire * volumes.master);
        return;
      }
      let played = false;
      for (const s of samplesFor(cue)) played = playSample(s.id, s.rate, s.gain) || played;
      if (!played) synthCue(cue);
    },
    playUi(cue) {
      if (muted) return;
      const s = uiSound(cue);
      if (!(s.sample && playSample(s.sample, 1, 1, gains.ui))) for (const v of s.voices) uiVoice(v);
      if (s.duck) duck(s.duck.bus, s.duck.level, s.duck.sec);
    },
    duck,
    setBed(on) {
      bedBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.3);
    },
    loadSamples(base) {
      return bank.load(base).then((state) => {
        const buffer = bank.get('crowd-bed');
        if (buffer && !bedSwapped && ctx.state !== 'closed') {
          bedSwapped = true;
          sampleBed(buffer);
        }
        return state;
      });
    },
    get samples() {
      return bank.state;
    },
    setVolume(bus, value) {
      volumes[bus] = value;
      gains[bus].gain.setTargetAtTime(value, ctx.currentTime, 0.05);
    },
    volume: (bus) => volumes[bus],
    setMuted(value) {
      muted = value;
      gains.master.gain.setTargetAtTime(value ? 0 : volumes.master, ctx.currentTime, 0.05);
      if (value) voice.cancel();
    },
    get muted() {
      return muted;
    },
    suspend() {
      voice.cancel();
      return ctx.suspend();
    },
    resume: () => ctx.resume(),
    get state() {
      return ctx.state;
    },
    dispose() {
      voice.cancel();
      void ctx.close();
    },
  };
}
