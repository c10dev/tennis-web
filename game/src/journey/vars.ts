// Template variables for the career's Korean text (ADR-032): a word with the particles its last syllable takes.
import { withJosa } from '../text/ko.ts';

export type Vars = Record<string, string | number>;

/** {key}, {keyTopic} 은/는, {keySubj} 이/가, {keyObj} 을/를, {keyWith} 과/와. */
export const particles = (key: string, word: string): Vars => ({
  [key]: word, [`${key}Topic`]: withJosa(word, '은', '는'), [`${key}Subj`]: withJosa(word, '이', '가'),
  [`${key}Obj`]: withJosa(word, '을', '를'), [`${key}With`]: withJosa(word, '과', '와'),
});

export const nameVars = (name: string): Vars => particles('name', name);

/** Replaces {name} placeholders. */
export const fill = (text: string, v: Vars): string => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
