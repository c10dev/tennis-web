// The one sound switch (ADR-029, ADR-022 step 6), pinned on every quick screen. A tap is a gesture, so turning sound
// on here starts the audio at once.
import { U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';
import { icon } from '../lib/icons.ts';
import { appSound } from './session.ts';

export function soundToggle(): { element: HTMLButtonElement; dispose(): void } {
  const sound = appSound();
  const label = h('span', { class: 'label' });
  const glyph = h('span', { class: 'glyph', 'aria-hidden': 'true' });
  const element = h('button', { type: 'button', class: 'sound-switch', id: 'sound-toggle', onclick: () => sound.setMuted(!sound.muted) }, glyph, label);
  const draw = (muted: boolean) => {
    element.setAttribute('aria-pressed', String(!muted));
    glyph.replaceChildren(icon(muted ? 'volume-x' : 'volume-2', 18));
    label.textContent = muted ? U.soundOff : U.soundOn;
  };
  draw(sound.muted);
  return { element, dispose: sound.subscribe(draw) };
}
