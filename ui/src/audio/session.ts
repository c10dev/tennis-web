// One audio session for the quick match (ADR-022, M7 step 6): one mixer shared by every broadcast, one on/off
// setting kept in the platform's settings, quiet in the background. The mixer is made inside a tap (Play or the
// switch), as iOS only lets audio start from a gesture; a resume the browser refuses is retried on the next tap.
// `document.body.dataset.audio` shows the state ('running', 'suspended' or 'off') for the e2e tests.
// The mixer alone (the renderer's `audio` entry): the main entry would pull Three.js into the first chunk (TD-014).
import { createMixer, type Mixer } from '@tennis/renderer/audio';
import { getPlatform } from '../platform/index.ts';
import { audioAction, parseSound, SOUND_KEY } from './policy.ts';

export interface AudioSession {
  readonly on: boolean;
  setOn(on: boolean): void;
  /** Call from a tap: makes the mixer if sound is on, and starts it. */
  unlock(): void;
  /** The mixer while sound is on, for the broadcast's cues. */
  mixer(): Mixer | null;
  /** Calls `fn` whenever the setting changes; returns an unsubscribe. */
  subscribe(fn: (on: boolean) => void): () => void;
}

function createSession(): AudioSession {
  let on = true;
  let mixer: Mixer | null = null;
  const listeners = new Set<(on: boolean) => void>();
  const mark = () => {
    document.body.dataset.audio = on && mixer ? mixer.state : 'off';
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
      mixer ??= createMixer();
      mixer.setMuted(false);
      resume();
      mark();
    },
    mixer: () => (on ? mixer : null),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return session;
}

let session: AudioSession | null = null;

export const getAudio = (): AudioSession => (session ??= createSession());
