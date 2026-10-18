// Every choice the career can bring (ADR-032).
import { LIFE_EVENTS } from './events-life.ts';
import { OFFERS, STAGE_EVENTS } from './events-stage.ts';
import type { LifeEvent } from './events.ts';

export const EVENTS: LifeEvent[] = [...STAGE_EVENTS, ...OFFERS, ...LIFE_EVENTS];
