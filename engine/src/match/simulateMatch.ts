// simulateMatch(config, seed) → MatchResult: the engine's entry point (GDD §3), a whole match in one step.
import type { MatchConfig, MatchResult, PlayerProfile, Tactic } from '../types.ts';
import { advance, finish, startMatch } from './live.ts';

export const DEFAULT_TACTIC: Tactic = { aggression: 0.5, netApproach: 0, targetBackhand: false, serveTarget: 'mix' };

export function createConfig(players: [PlayerProfile, PlayerProfile], options: Partial<Omit<MatchConfig, 'players'>> = {}): MatchConfig {
  return {
    players,
    surface: 'hard',
    rules: { bestOf: 3, noAd: false, finalSet: 'tiebreak7' },
    tactics: [{ ...DEFAULT_TACTIC }, { ...DEFAULT_TACTIC }],
    firstServer: 'A',
    ...options,
  };
}

export function simulateMatch(config: MatchConfig, seed: number): MatchResult {
  const live = startMatch(config, seed);
  advance(live, 'match');
  return finish(live);
}
