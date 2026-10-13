// A player's card: ratings by area with training progress, condition, season results. AI potential stays hidden.
import { TIERS } from '../calendar/tiers.ts';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { playerById, type SeasonState } from '../season/state.ts';
import type { Rated } from '../tuning.ts';
import { fatigueLabel, RATING_LABEL as LABELS, resultLabel, STYLE_LABEL } from './format.ts';

const GROUPS: [string, Rated[]][] = [
  ['Serve', ['servePower', 'serveAccuracy', 'secondServe']],
  ['Groundstrokes', ['forehand', 'backhand', 'consistency']],
  ['Return', ['return']],
  ['Movement', ['movement', 'agility', 'stamina']],
  ['Mental', ['composure', 'concentration', 'decision', 'aggression']],
];


export function playerView(s: SeasonState, id: string) {
  const p = playerById(s, id);
  const stars = Math.max(1, Math.min(5, Math.round((p.potential - 12) / 1.5)));
  return {
    id, name: p.name, age: p.age, style: STYLE_LABEL[p.style], overall: Math.round(overall(p) * 10) / 10, isUser: id === USER_ID,
    potential: id === USER_ID ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : null,
    fatigue: fatigueLabel(p.fatigue), injuryWeeks: p.injuryWeeks,
    groups: GROUPS.map(([label, keys]) => ({
      label, ratings: keys.map((key) => ({ key, label: LABELS[key]!, value: p.attributes[key], progress: Math.max(0, p.progress[key] ?? 0) })),
    })),
    results: s.history.filter((h) => id in h.roundsWon).map((h) => ({ week: h.week, name: h.name, result: resultLabel(TIERS[h.tier].draw, h.roundsWon[id]!) })),
  };
}
