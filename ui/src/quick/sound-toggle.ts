// The sound toggle on every quick screen (ADR-023): a paper pill in the top-right corner, pressed while sound is on.
// Its name stays "Sound" and aria-pressed carries the state, so a screen reader never hears "Sound off, not pressed".
import { h } from '../lib/h.ts';
import { icon } from '../lib/icons.ts';
import type { AppSound } from '../lib/sound.ts';

export function soundToggle(sound: AppSound): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'sound-pill', id: 'sound-toggle', 'aria-label': 'Sound' });
  const draw = () => {
    // Narrow screens hide the label (CSS) but keep it as the button's name.
    button.replaceChildren(icon(sound.muted ? 'volume-x' : 'volume-2', 18), h('span', { class: 'label' }, sound.muted ? 'Sound off' : 'Sound on'));
    button.setAttribute('aria-pressed', String(!sound.muted));
  };
  button.addEventListener('click', () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    draw();
  });
  draw();
  return button;
}
