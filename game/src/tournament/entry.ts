// Entry lists: the best-ranked of those who want to play, up to the draw size.

/** `ranking` is best first; `wants` says who entered. */
export function entryList(ranking: readonly string[], wants: (id: string) => boolean, size: number): string[] {
  return ranking.filter(wants).slice(0, size);
}
