// The app's one sound (ADR-023): a mixer made on the first gesture (autoplay policy), on by default, mute remembered in
// localStorage. Quick screens play UI cues through it and quick matches hand it to the broadcast for ball and crowd.
import { AUDIO, createMixer, type Mixer, type UiCue } from '@tennis/renderer/audio';

const KEY = 'tennis-sound';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface AppSound {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** Makes the mixer, or wakes it if the browser created it suspended; call from every user gesture. */
  unlock(): void;
  /** Plays a UI cue while on; nothing before the first gesture or while muted. */
  ui(cue: UiCue): void;
  /** The crowd murmur: on in matches, off on menus (applied when the mixer appears, if asked before). */
  setBed(on: boolean): void;
  /** The mixer while sound is on, for the broadcast's ball and crowd cues; null before the first gesture or muted. */
  readonly mixer: Mixer | null;
}

export interface AppSoundDeps {
  make(): Mixer;
  storage: Store | null;
  /** Milliseconds, for spacing count-up ticks. */
  now(): number;
  /** Hears every cue that played (the e2e tests read it). */
  log?(cue: UiCue): void;
}

function read(storage: Store | null): boolean {
  try {
    return storage?.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function createAppSound(deps: AppSoundDeps): AppSound {
  let mixer: Mixer | null = null;
  let muted = read(deps.storage);
  let bed = false;
  let lastTick = -Infinity;
  return {
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      mixer?.setMuted(value);
      if (!value) mixer?.resume();
      try {
        deps.storage?.setItem(KEY, value ? 'off' : 'on');
      } catch {
        // Private windows may refuse storage; the choice then lasts for this page only.
      }
    },
    unlock() {
      if (!mixer) {
        mixer = deps.make();
        mixer.setMuted(muted);
        mixer.setBed(bed);
      }
      mixer.resume();
    },
    ui(cue) {
      if (!mixer || muted) return;
      if (cue.kind === 'tick') {
        const now = deps.now();
        if (now - lastTick < AUDIO.ui.tick.minGapSec * 1000) return;
        lastTick = now;
      }
      mixer.playUi(cue);
      deps.log?.(cue);
    },
    setBed(on) {
      bed = on;
      mixer?.setBed(on);
    },
    get mixer() {
      return mixer && !muted ? mixer : null;
    },
  };
}

let app: AppSound | null = null;

/** The page's sound, unlocked by the page's gestures. A touch screen allows audio on the end of a tap (pointerup,
 *  click), not on the first touch, so every gesture tries again; resuming a running context does nothing. */
export function appSound(): AppSound {
  if (app) return app;
  let storage: Store | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const deps: AppSoundDeps = { make: createMixer, storage, now: () => performance.now() };
  if (import.meta.env.DEV) deps.log = (cue) => ((window as unknown as { __sfx?: UiCue[] }).__sfx ??= []).push(cue);
  const sound = createAppSound(deps);
  const unlock = () => sound.unlock();
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown'] as const) window.addEventListener(type, unlock, { capture: true });
  app = sound;
  return sound;
}
