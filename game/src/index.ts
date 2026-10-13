// Public API of the game layer (ADR-011): career state and rules, headless and deterministic.
export { createPlayer, defaultAllocation, USER_ID, type Allocation, type CreatableStyle, type NewPlayer } from './player/create.ts';
export { overall } from './player/overall.ts';
export { CREATION, EDITABLE, STYLES } from './tuning.ts';
export type { CareerPlayer, World } from './types.ts';
export { generateWorld } from './world/generate.ts';
