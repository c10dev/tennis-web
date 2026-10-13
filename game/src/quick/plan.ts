// The user's game plan (ADR-017): how the points without cards are played.
import { DEFAULT_TACTIC, type Tactic } from '@tennis/engine';
import { QUICK_PLAN } from '../tuning.ts';
import type { GamePlan } from './types.ts';

export const PLANS: readonly GamePlan[] = ['aggressive', 'balanced', 'defensive'];

export const planTactic = (plan: GamePlan): Tactic => ({ ...DEFAULT_TACTIC, ...QUICK_PLAN[plan] });
