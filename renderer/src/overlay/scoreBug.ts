// Score bug view model (GDD §8.2): what the top-left box shows, independent of how it is drawn.
import type { PlayerId, ScoreState } from '@tennis/engine';

export interface ScoreBugRow {
  name: string;
  /** Games in every finished set. */
  sets: number[];
  /** Games in the current set; null once the match is over, and in one-tiebreak matches. */
  games: number | null;
  /** "0", "15", "30", "40", "AD", "" or a tiebreak count. */
  points: string;
  serving: boolean;
  winner: boolean;
}

export interface ScoreBugModel {
  rows: [ScoreBugRow, ScoreBugRow];
  tiebreak: boolean;
  final: boolean;
}

const CALLS = ['0', '15', '30', '40'];

function calls(score: ScoreState, noAd: boolean): [string, string] {
  const [a, b] = score.points;
  if (score.tiebreak) return [String(a), String(b)];
  if (a >= 3 && b >= 3) {
    if (a === b || noAd) return ['40', '40'];
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }
  return [CALLS[a]!, CALLS[b]!];
}

export function scoreBugModel(
  score: ScoreState, names: [string, string], options: { noAd: boolean; winner: PlayerId | null; games?: boolean },
): ScoreBugModel {
  const final = options.winner !== null;
  const points = final ? ['', ''] : calls(score, options.noAd);
  const row = (i: 0 | 1, id: PlayerId): ScoreBugRow => ({
    name: names[i],
    sets: score.sets.map((set) => set[i]),
    games: final || options.games === false ? null : score.games[i],
    points: points[i]!,
    serving: !final && score.server === id,
    winner: options.winner === id,
  });
  return { rows: [row(0, 'A'), row(1, 'B')], tiebreak: !final && score.tiebreak, final };
}
