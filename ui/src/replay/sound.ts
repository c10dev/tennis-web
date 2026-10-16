// Sound toggle and mixer sliders. Audio starts on the first click (browser autoplay policy) and stays off until then;
// that click also starts loading the generated samples (ADR-027).
import { createMixer, type Bus, type Mixer } from '@tennis/renderer';

export interface Sound {
  /** The mixer while sound is on; null when off or never started. */
  readonly mixer: Mixer | null;
  /** Closes the mixer this panel made, muted or not. */
  dispose(): void;
}

const BUSES: [Bus, string][] = [['master', 'Master'], ['sfx', 'Ball'], ['crowd', 'Crowd'], ['umpire', 'Umpire']];

export function createSound(root: HTMLElement): Sound {
  let mixer: Mixer | null = null;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sound-toggle';
  toggle.textContent = '🔇 Sound off';
  const sliders = document.createElement('div');
  sliders.className = 'sliders';
  sliders.hidden = true;
  toggle.addEventListener('click', () => {
    if (!mixer) {
      mixer = createMixer();
      void mixer.loadSamples(`${import.meta.env.BASE_URL}audio/`);
      for (const [bus, label] of BUSES) sliders.append(slider(mixer, bus, label));
    } else mixer.setMuted(!mixer.muted);
    const on = !mixer.muted;
    toggle.textContent = on ? '🔊 Sound on' : '🔇 Sound off';
    sliders.hidden = !on;
  });
  root.append(toggle, sliders);
  return {
    get mixer() {
      return mixer && !mixer.muted ? mixer : null;
    },
    dispose() {
      mixer?.dispose();
      mixer = null;
    },
  };
}

function slider(mixer: Mixer, bus: Bus, label: string): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.05';
  input.value = String(mixer.volume(bus));
  input.addEventListener('input', () => mixer.setVolume(bus, Number(input.value)));
  const wrap = document.createElement('label');
  wrap.append(label, input);
  return wrap;
}
