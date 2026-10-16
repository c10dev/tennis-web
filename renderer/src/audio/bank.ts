// Loads the generated samples (TD-016, ADR-027) once, when sound is first turned on: one fetch per sample in the format
// the browser plays, decoded into buffers. A sample that is missing or will not decode is skipped (the mixer then
// synthesises that cue), so the state is 'ready', 'partial' or 'failed', never an error. Browser-only.
import { SAMPLE_IDS, sampleFormat, sampleUrl, type SampleId } from './samples.ts';

export type SampleState = 'none' | 'loading' | 'ready' | 'partial' | 'failed';

export interface Bank {
  readonly state: SampleState;
  get(id: SampleId): AudioBuffer | undefined;
  /** Starts loading from `base` (ending in '/'); later calls return the same promise. */
  load(base: string): Promise<SampleState>;
}

const canPlay = (type: string): string => (typeof Audio === 'undefined' ? '' : new Audio().canPlayType(type));

export function createBank(ctx: BaseAudioContext): Bank {
  const buffers = new Map<SampleId, AudioBuffer>();
  let state: SampleState = 'none';
  let loading: Promise<SampleState> | null = null;
  const fetchOne = async (base: string, id: SampleId, ext: 'ogg' | 'm4a') => {
    const res = await fetch(sampleUrl(base, id, ext));
    if (!res.ok) throw new Error(`${id}: ${res.status}`);
    buffers.set(id, await ctx.decodeAudioData(await res.arrayBuffer()));
  };
  return {
    get state() {
      return state;
    },
    get: (id) => buffers.get(id),
    load(base) {
      if (loading) return loading;
      state = 'loading';
      const ext = sampleFormat(canPlay);
      loading = Promise.allSettled(SAMPLE_IDS.map((id) => fetchOne(base, id, ext))).then(() => {
        state = buffers.size === SAMPLE_IDS.length ? 'ready' : buffers.size > 0 ? 'partial' : 'failed';
        return state;
      });
      return loading;
    },
  };
}
