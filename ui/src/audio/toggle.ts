// The one sound switch (ADR-022): on the ladder and over the match. A tap is a gesture, so turning sound on here
// can start the audio at once.
import { U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';
import { getAudio } from './session.ts';

export function soundToggle(): { element: HTMLButtonElement; dispose(): void } {
  const audio = getAudio();
  const label = h('span', { class: 'label' });
  const glyph = h('span', { 'aria-hidden': 'true' });
  const element = h('button', { type: 'button', class: 'sound-switch', id: 'sound-toggle', onclick: () => audio.setOn(!audio.on) }, glyph, label);
  const draw = (on: boolean) => {
    element.setAttribute('aria-pressed', String(on));
    glyph.textContent = on ? '🔊' : '🔇';
    label.textContent = on ? U.soundOn : U.soundOff;
  };
  draw(audio.on);
  return { element, dispose: audio.subscribe(draw) };
}
