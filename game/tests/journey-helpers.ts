// Test players for the journey: a 14-year-old for the long career, an 18-year-old room pro.
import { createPro, type CreatableStyle, type Talents } from '../src/journey/ratings.ts';
import type { JPlayer } from '../src/journey/types.ts';

export const junior = (name = '김테니', style: CreatableStyle = 'baseliner', talents: Talents = { forehand: 4, serve: 3, physical: 3 }, potential = 15.6): JPlayer =>
  createPro({ name, nation: 'KOR', style }, talents, { age: 14, ovr: 45, potential });

export const pro = (name = '김테니', style: CreatableStyle = 'baseliner', talents: Talents = { forehand: 4, serve: 3, physical: 3 }): JPlayer =>
  createPro({ name, nation: 'KOR', style }, talents);
