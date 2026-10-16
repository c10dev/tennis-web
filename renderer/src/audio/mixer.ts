// Web Audio synthesis for the cues (GDD §8.4): no sample files. Ball sounds are short filtered noise and tones,
// the crowd is filtered noise (a bed plus applause bursts). Browser-only and not unit-tested; cues.ts decides
// what plays and when.
import { AUDIO } from '../tuning/index.ts';
import type { Cue } from './cues.ts';
import { createVoice } from './voice.ts';

export type Bus = 'master' | 'sfx' | 'crowd' | 'umpire';

export interface Mixer {
  play(cue: Cue): void;
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

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

/** Must be created from a user gesture (autoplay policy). */
export function createMixer(): Mixer {
  const ctx = new AudioContext();
  const volumes: Record<Bus, number> = { ...AUDIO.volume };
  const gains = {} as Record<Bus, GainNode>;
  for (const bus of ['master', 'sfx', 'crowd', 'umpire'] as const) {
    gains[bus] = ctx.createGain();
    gains[bus].gain.value = volumes[bus];
    if (bus !== 'master') gains[bus].connect(gains.master);
  }
  gains.master.connect(ctx.destination);
  const noise = noiseBuffer(ctx, 2);
  const voice = createVoice();
  let muted = false;

  // A low crowd murmur that never stops.
  const bed = ctx.createBufferSource();
  bed.buffer = noise;
  bed.loop = true;
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = 'lowpass';
  bedFilter.frequency.value = 500;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.12;
  bed.connect(bedFilter).connect(bedGain).connect(gains.crowd);
  bed.start();

  const burst = (bus: Bus, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, offset = 0) => {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter).connect(env).connect(gains[bus]);
    src.start(t, offset);
    src.stop(t + attack + decay + 0.05);
  };
  const tone = (freq: number, peak: number, decay: number) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(env).connect(gains.sfx);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  };

  return {
    play(cue) {
      if (muted) return;
      const soft = 'replay' in cue && cue.replay ? 0.6 : 1;
      switch (cue.kind) {
        case 'hit': {
          const power = Math.min(1, cue.speedKmh / 200);
          burst('sfx', 'bandpass', 1800 + 1400 * power, 1.2, 0.6 * soft * (0.5 + power), 0.002, 0.05, Math.random());
          tone(cue.shot === 'serve' ? 520 : 440, 0.35 * soft, 0.06);
          break;
        }
        case 'bounce':
          burst('sfx', 'lowpass', cue.surface === 'clay' ? 500 : cue.surface === 'grass' ? 650 : 900, 0.7, 0.35 * soft, 0.002, 0.07, Math.random());
          break;
        case 'net':
          burst('sfx', 'lowpass', 300, 0.7, 0.4 * soft, 0.005, 0.18, Math.random());
          break;
        case 'crowd':
          // Applause: a swell of bright noise whose loudness and length follow the moment.
          burst('crowd', 'bandpass', 2500, 0.4, 0.15 + 0.65 * cue.intensity, 0.25, 1 + 2.5 * cue.intensity, Math.random());
          break;
        case 'call':
          voice.say(cue.text, volumes.umpire * volumes.master);
          break;
      }
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
