import { describe, expect, it, vi } from 'vitest';
import type { Mixer, UiCue } from '@tennis/renderer/audio';
import { AUDIO } from '@tennis/renderer/audio';
import { createAppSound } from '../src/lib/sound.ts';

// The app's one sound (ADR-023): made on the first gesture, on by default, mute remembered, UI cues only while on.
function fakeMixer() {
  return { playUi: vi.fn(), setMuted: vi.fn(), setBed: vi.fn(), play: vi.fn(), dispose: vi.fn() } as unknown as Mixer & {
    playUi: ReturnType<typeof vi.fn>; setMuted: ReturnType<typeof vi.fn>; setBed: ReturnType<typeof vi.fn>;
  };
}
function fakeStorage(init: Record<string, string> = {}) {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}
const pick: UiCue = { kind: 'pick' };

describe('createAppSound', () => {
  it('is on by default but silent until the first gesture makes the mixer', () => {
    const mixer = fakeMixer();
    const make = vi.fn(() => mixer);
    const s = createAppSound({ make, storage: fakeStorage(), now: () => 0 });
    expect(s.muted).toBe(false);
    s.ui(pick);
    expect(make).not.toHaveBeenCalled();
    expect(s.mixer).toBeNull();
    s.unlock();
    s.unlock();
    expect(make).toHaveBeenCalledTimes(1);
    s.ui(pick);
    expect(mixer.playUi).toHaveBeenCalledWith(pick);
    expect(s.mixer).toBe(mixer);
  });

  it('remembers mute, plays nothing and hands no mixer to the broadcast while muted', () => {
    const storage = fakeStorage();
    const mixer = fakeMixer();
    const log = vi.fn();
    const s = createAppSound({ make: () => mixer, storage, now: () => 0, log });
    s.unlock();
    s.setMuted(true);
    expect(storage.data['tennis-sound']).toBe('off');
    expect(mixer.setMuted).toHaveBeenLastCalledWith(true);
    s.ui(pick);
    expect(mixer.playUi).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(s.mixer).toBeNull();
    const again = createAppSound({ make: fakeMixer, storage, now: () => 0 });
    expect(again.muted).toBe(true);
  });

  it('starts a new mixer muted when mute was saved, and applies the crowd bed asked for before it existed', () => {
    const mixer = fakeMixer();
    const s = createAppSound({ make: () => mixer, storage: fakeStorage({ 'tennis-sound': 'off' }), now: () => 0 });
    s.setBed(true);
    s.unlock();
    expect(mixer.setMuted).toHaveBeenCalledWith(true);
    expect(mixer.setBed).toHaveBeenCalledWith(true);
  });

  it('logs what it plays, and drops count-up ticks closer together than the minimum gap', () => {
    let t = 0;
    const mixer = fakeMixer();
    const log = vi.fn();
    const s = createAppSound({ make: () => mixer, storage: null, now: () => t, log });
    s.unlock();
    const tick = (i: number): UiCue => ({ kind: 'tick', i, n: 10, down: false });
    s.ui(tick(0));
    t += AUDIO.ui.tick.minGapSec * 500;
    s.ui(tick(1));
    t += AUDIO.ui.tick.minGapSec * 1000;
    s.ui(tick(2));
    s.ui(pick);
    expect(log.mock.calls.map((c) => c[0])).toEqual([tick(0), tick(2), pick]);
  });
});
