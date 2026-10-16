// The user's game plan (ADR-017): how the points without cards are played. The opponent answers it (ADR-025): it
// matches the plan's tempo, and a specialist style is thrown off balance by one plan, the one its tip names.
import { DEFAULT_TACTIC, type PlayStyle, type Tactic } from '@tennis/engine';
import { QUICK_PLAN } from '../tuning.ts';
import type { GamePlan } from './types.ts';

export const PLANS: readonly GamePlan[] = ['aggressive', 'balanced', 'defensive'];

export const planTactic = (plan: GamePlan): Tactic => ({ ...DEFAULT_TACTIC, ...QUICK_PLAN[plan] });

const TIPS: Partial<Record<PlayStyle, GamePlan>> = QUICK_PLAN.opponent.tips;

/** The plan that throws an opponent of this style off balance, or null when none does. */
export const planTip = (style: PlayStyle): GamePlan | null => TIPS[style] ?? null;

/** The opponent's tactic on points without cards against the user's plan. */
export function opponentTactic(style: PlayStyle, plan: GamePlan): Tactic {
  const { tempo, offBalance } = QUICK_PLAN.opponent;
  const tip = planTip(style);
  const shift = tip === null ? 0 : tip === plan ? -offBalance : offBalance / 2;
  const aggression = Math.min(1, Math.max(0, 0.5 + tempo * (QUICK_PLAN[plan].aggression - 0.5) + shift));
  return { ...planTactic('balanced'), aggression: Math.round(aggression * 1000) / 1000 };
}
