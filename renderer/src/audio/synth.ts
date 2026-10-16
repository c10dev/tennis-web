// Web Audio synthesis (GDD §8.4): filtered-noise bursts and decaying tones. The ball and crowd fall back to these until
// their samples load (TD-016). The screen sounds are voices from uiCues.ts (ADR-029), played by the mixer.
// Browser-only and not unit-tested.

export interface Synth {
  /** Noise through a filter with an attack/decay envelope, from a random point in the first second of the noise. */
  burst(out: AudioNode, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number): void;
  /** A tone gliding down to `glide` × its pitch while it decays; `delay` seconds from now. */
  tone(out: AudioNode, freq: number, peak: number, decay: number, delay?: number, glide?: number, type?: OscillatorType): void;
}

export function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

export function createSynth(ctx: AudioContext, noise: AudioBuffer): Synth {
  const synth: Synth = {
    burst(out, type, freq, q, peak, attack, decay) {
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
      src.connect(filter).connect(env).connect(out);
      src.start(t, Math.random());
      src.stop(t + attack + decay + 0.05);
    },
    tone(out, freq, peak, decay, delay = 0, glide = 0.6, type = 'sine') {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * glide, t + decay);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.setValueAtTime(peak, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.02);
    },
  };
  return synth;
}
