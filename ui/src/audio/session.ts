// The page's one sound (ADR-029 core, ADR-022 step 6): the core in lib/sound.ts (mixer on the first gesture, UI cues,
// crowd bed, remembered mute) plus what the Toss build needs. The mute is kept in the platform settings too (Toss
// storage); a hidden page suspends the audio at once and a return resumes it if sound is on; a resume the browser
// refuses (iOS WKWebView) is retried on the next tap. `document.body.dataset.audio` shows 'running', 'suspended' or
// 'off' for the e2e tests.
import { createMixer, type UiCue } from '@tennis/renderer/audio';
import { createAppSound, type AppSound, type AppSoundDeps } from '../lib/sound.ts';
import { getPlatform } from '../platform/index.ts';
import { audioAction, parseSound, SOUND_KEY } from './policy.ts';

export interface AudioSession extends AppSound {
  /** Calls `fn` with the new mute whenever it changes; returns an unsubscribe. */
  subscribe(fn: (muted: boolean) => void): () => void;
}

function createSession(): AudioSession {
  let storage: AppSoundDeps['storage'];
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const deps: AppSoundDeps = { make: createMixer, storage, now: () => performance.now() };
  if (import.meta.env.DEV) deps.log = (cue: UiCue) => ((window as unknown as { __sfx?: UiCue[] }).__sfx ??= []).push(cue);
  const core = createAppSound(deps);
  const listeners = new Set<(muted: boolean) => void>();
  const mark = () => {
    document.body.dataset.audio = !core.muted && core.made ? core.made.state : 'off';
  };
  const notify = () => {
    for (const fn of listeners) fn(core.muted);
    mark();
  };
  const resume = () => {
    const mixer = core.made;
    if (!mixer || core.muted) return;
    void mixer.resume().catch(() => undefined).then(() => {
      mark();
      if (core.made?.state !== 'running') document.addEventListener('pointerdown', () => !document.hidden && resume(), { once: true, capture: true });
    });
  };
  const suspend = () => void core.made?.suspend().catch(() => undefined).then(mark);
  // The Toss build keeps the mute in the Toss storage (the web's platform settings are this same localStorage key).
  void getPlatform().then((p) => (p.kind === 'toss' ? p.kv.get(SOUND_KEY) : null)).then((value) => {
    if (value === null) return;
    const muted = !parseSound(value);
    if (muted !== core.muted) {
      core.setMuted(muted);
      notify();
    }
  });
  document.addEventListener('visibilitychange', () => {
    const action = audioAction(document.hidden, !core.muted);
    if (action === 'suspend') suspend();
    else if (action === 'resume') resume();
  });
  window.addEventListener('pagehide', suspend);
  const session: AudioSession = {
    get muted() {
      return core.muted;
    },
    setMuted(muted) {
      core.setMuted(muted);
      void getPlatform().then((p) => p.kv.set(SOUND_KEY, muted ? 'off' : 'on'));
      if (muted) suspend();
      else session.unlock();
      notify();
    },
    unlock() {
      core.unlock();
      resume();
      mark();
    },
    ui: (cue) => core.ui(cue),
    setBed: (on) => core.setBed(on),
    get mixer() {
      return core.mixer;
    },
    get made() {
      return core.made;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  // The first tap or key press anywhere opens the audio (autoplay policy); Play and the switch do it again.
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => session.unlock(), { capture: true, once: true });
  return session;
}

let session: AudioSession | null = null;

export const appSound = (): AudioSession => (session ??= createSession());
