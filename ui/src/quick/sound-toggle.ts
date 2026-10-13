// The sound toggle on every quick screen (ADR-023): a paper pill in the top-right corner, pressed while sound is on.
import { h } from '../lib/h.ts';
import { icon } from '../lib/icons.ts';
import type { AppSound } from '../lib/sound.ts';

export function soundToggle(sound: AppSound): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'sound-pill', id: 'sound-toggle' });
  const draw = () => {
    button.replaceChildren(icon(sound.muted ? 'volume-x' : 'volume-2', 18), sound.muted ? ' Sound off' : ' Sound on');
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
