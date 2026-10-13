// The engine's view of a career player: name, style and ratings only (no hidden or dynamic state).
import type { PlayerProfile } from '@tennis/engine';
import type { CareerPlayer } from '../types.ts';

export const profileOf = (p: CareerPlayer): PlayerProfile => ({ name: p.name, style: p.style, attributes: p.attributes });
