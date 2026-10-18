// The room cup (ADR-033): at the end of every swing the room's players who are fit play a knockout among themselves
// on the engine. No ranking points; friends meet every swing, whatever their schedules.
import { stream } from '../rng.ts';
import { champion, playRound, startBracket } from '../tournament/bracket.ts';
import { makeDraw } from '../tournament/draw.ts';
import { SWINGS, type JEvent } from './calendar.ts';
import { engineMatch, type HumanInPlay } from './play.ts';
import type { JPlayer, MatchLine } from './types.ts';

export interface CupResult {
  /** Each player's matches, by player id. */
  lines: Map<string, MatchLine[]>;
  winner: string;
}

/** The cup's event: best of three on the surface of the swing's Major, in its last week. */
export function cupEvent(swing: number): JEvent {
  const major = SWINGS[swing]!.events.find((e) => e.tier === 'major')!;
  return { id: 'room-cup', name: '룸 컵', tier: 'finals', surface: major.surface, week: 12, weeks: 1, region: major.region };
}

/** `players` best ranked first; null with fewer than two. */
export function playCup(seed: number, key: string, swing: number, players: readonly JPlayer[], humans: ReadonlyMap<string, HumanInPlay>,
  rankOf: (id: string) => number | null): CupResult | null {
  if (players.length < 2) return null;
  const size = 2 ** Math.ceil(Math.log2(players.length));
  const ev = cupEvent(swing);
  const byId = new Map(players.map((p) => [p.id, p]));
  let bracket = startBracket(makeDraw(players.map((p) => p.id), size, stream(seed, 'cup', key)));
  const lines = new Map<string, MatchLine[]>(players.map((p) => [p.id, []]));
  const rounds = Math.log2(size);
  const ctx = { seed, key: `${key}/cup`, humans, rankOf };
  for (let round = 1; round <= rounds; round++) {
    let pair = 0;
    bracket = playRound(bracket, (a, b) => {
      const m = engineMatch(ctx, ev, round, rounds, pair++, byId.get(a)!, byId.get(b)!).line;
      lines.get(a)!.push(m);
      const score = m.score.split(' ').filter(Boolean).map((set) => set.split('-').reverse().join('-')).join(' ');
      lines.get(b)!.push({ ...m, opponent: a, opponentName: byId.get(a)!.name, opponentRank: rankOf(a), won: !m.won, score });
      return m.won ? a : b;
    });
  }
  return { lines, winner: champion(bracket)! };
}
