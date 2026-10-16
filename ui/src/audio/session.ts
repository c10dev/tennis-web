// One audio session for the quick match (ADR-022, M7 step 6): one mixer shared by every broadcast, one on/off
// setting kept in the platform's settings, quiet in the background. The mixer is made inside a tap (Play or the
// switch), as iOS only lets audio start from a gesture; a resume the browser refuses is retried on the next tap.
// `document.body.dataset.audio` shows the state ('running', 'suspended' or 'off') for the e2e tests.
// The generated samples (ADR-027) are fetched on that first tap, not before, so they never slow the first screen;
// `dataset.audioSamples` shows their state ('none', 'loading', 'ready', 'partial' or 'failed').
// The mixer alone (the renderer's `audio` entry): the main entry would pull Three.js into the first chunk (TD-014).
import { createMixer, type Mixer, type UiSound } from '@tennis/renderer/audio';
import { getPlatform } from '../platform/index.ts';
import { audioAction, parseSound, SOUND_KEY } from './policy.ts';

export interface AudioSession {
  readonly on: boolean;
  setOn(on: boolean): void;
  /** Call from a tap: makes the mixer if sound is on, and starts it. */
  unlock(): void;
  /** The mixer while sound is on, for the broadcast's cues. */
  mixer(): Mixer | null;
  /** Plays screen sounds (reveal, count-up, result) if sound is on; a duck always applies. */
  ui(sounds: readonly UiSound[]): void;
  /** Calls `fn` whenever the setting changes; returns an unsubscribe. */
  subscribe(fn: (on: boolean) => void): () => void;
}

/** Where the samples are: next to the page (the toss build's base is './'). */
const SAMPLES = `${import.meta.env.BASE_URL}audio/`;

function createSession(): AudioSession {
  let on = true;
  let mixer: Mixer | null = null;
  const listeners = new Set<(on: boolean) => void>();
  const mark = () => {
    document.body.dataset.audio = on && mixer ? mixer.state : 'off';
    document.body.dataset.audioSamples = mixer?.samples ?? 'none';
  };
  const notify = () => {
    for (const fn of listeners) fn(on);
    mark();
  };
  const resume = () => {
    if (!mixer || !on) return;
    void mixer.resume().catch(() => undefined).then(() => {
      mark();
      // WKWebView may refuse to resume without a gesture: try again on the next tap.
      if (mixer?.state !== 'running') document.addEventListener('pointerdown', () => !document.hidden && resume(), { once: true, capture: true });
    });
  };
  const suspend = () => void mixer?.suspend().catch(() => undefined).then(mark);
  void getPlatform().then((p) => p.kv.get(SOUND_KEY)).then((value) => {
    on = parseSound(value);
    notify();
  });
  document.addEventListener('visibilitychange', () => {
    const action = audioAction(document.hidden, on);
    if (action === 'suspend') suspend();
    else if (action === 'resume') resume();
  });
  window.addEventListener('pagehide', suspend);
  const session: AudioSession = {
    get on() {
      return on;
    },
    setOn(next) {
      on = next;
      void getPlatform().then((p) => p.kv.set(SOUND_KEY, next ? 'on' : 'off'));
      if (next) session.unlock();
      else {
        mixer?.setMuted(true);
        suspend();
      }
      notify();
    },
    unlock() {
      if (!on) return;
      if (!mixer) {
        mixer = createMixer();
        void mixer.loadSamples(SAMPLES).then(mark);
      }
      mixer.setMuted(false);
      resume();
      mark();
    },
    mixer: () => (on ? mixer : null),
    ui(sounds) {
      // The duck reaches the mixer even while off, so a reveal cut short by the switch never leaves the crowd low.
      for (const s of sounds) if (on || s.kind === 'duck') mixer?.ui(s);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return session;
}

let session: AudioSession | null = null;

export const getAudio = (): AudioSession => (session ??= createSession());
