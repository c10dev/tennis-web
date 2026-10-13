// A knockout bracket as data: rounds[0] is the draw, rounds[r] the players through round r. Immutable updates.

export interface Bracket {
  readonly rounds: readonly (readonly (string | null)[])[];
}

export const startBracket = (slots: (string | null)[]): Bracket => ({ rounds: [slots] });

/** The pairs to be played in the next round, byes left out. */
export function nextPairs(b: Bracket): [string, string][] {
  const last = b.rounds.at(-1)!;
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < last.length; i += 2) if (last[i] && last[i + 1]) pairs.push([last[i]!, last[i + 1]!]);
  return pairs;
}

/** Plays the next round: `play` decides each real match; a bye sends its opponent through. */
export function playRound(b: Bracket, play: (a: string, b: string) => string): Bracket {
  const last = b.rounds.at(-1)!;
  if (last.length < 2) throw new Error('The bracket is finished');
  const next: (string | null)[] = [];
  for (let i = 0; i < last.length; i += 2) {
    const [x, y] = [last[i] ?? null, last[i + 1] ?? null];
    next.push(x && y ? play(x, y) : (x ?? y));
  }
  return { rounds: [...b.rounds, next] };
}

export function champion(b: Bracket): string | null {
  const last = b.rounds.at(-1)!;
  return last.length === 1 ? last[0]! : null;
}

/** Rounds a player has come through (a bye counts): index into the tier's points table. */
export function roundsWon(b: Bracket, id: string): number {
  let won = 0;
  for (let r = 1; r < b.rounds.length; r++) if (b.rounds[r]!.includes(id)) won = r;
  return won;
}

/** Number of rounds in a draw of this size. */
export const roundCount = (b: Bracket): number => Math.log2(b.rounds[0]!.length);
