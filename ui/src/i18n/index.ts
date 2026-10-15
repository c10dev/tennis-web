// The page language (ADR-022): Korean in the Toss build; on the web English, or Korean with `?lang=ko`. `T` holds
// the game's sentences (`@tennis/game` catalogs), `U` the UI's own words; both are fixed for the page's life.
import { textFor, type Lang } from '@tennis/game';
import { TARGET, type Target } from '../target.ts';
import { enUi } from './en.ts';
import { koUi } from './ko.ts';
import type { UiText } from './types.ts';

export type { UiText } from './types.ts';

export function langFor(target: Target, search: string): Lang {
  return target === 'toss' || new URLSearchParams(search).get('lang') === 'ko' ? 'ko' : 'en';
}

export const uiText = (lang: Lang): UiText => (lang === 'ko' ? koUi : enUi);

export const LANG: Lang = langFor(TARGET, typeof location === 'undefined' ? '' : location.search);
export const T = textFor(LANG);
export const U = uiText(LANG);
