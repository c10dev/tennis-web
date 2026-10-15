// Text catalogs (ADR-022).
import { en } from './en.ts';
import { ko } from './ko.ts';
import type { Lang, Messages } from './types.ts';

export type { Lang, Messages } from './types.ts';
export { en, ko };

export const textFor = (lang: Lang): Messages => (lang === 'ko' ? ko : en);
