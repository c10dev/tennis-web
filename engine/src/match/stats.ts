import type { MatchStats, PlayerId, PointEvent } from '../types.ts';

const idx = (p: PlayerId): 0 | 1 => (p === 'A' ? 0 : 1);

/** Match statistics from the point events (definitions in ADR-004). Winners exclude aces. */
export function computeStats(points: readonly PointEvent[]): MatchStats {
  const aces: [number, number] = [0, 0];
  const doubleFaults: [number, number] = [0, 0];
  const winners: [number, number] = [0, 0];
  const unforcedErrors: [number, number] = [0, 0];
  const served: [number, number] = [0, 0];
  const firstIn: [number, number] = [0, 0];
  const bpChances: [number, number] = [0, 0];
  const bpWon: [number, number] = [0, 0];
  let rally = 0;
  for (const p of points) {
    const s = idx(p.server);
    const r = s === 0 ? 1 : 0;
    served[s] += 1;
    if (p.serveNumber === 1) firstIn[s] += 1;
    if (p.endedBy === 'ace') aces[s] += 1;
    if (p.endedBy === 'double_fault') doubleFaults[s] += 1;
    if (p.endedBy === 'winner') winners[idx(p.winner)] += 1;
    if (p.endedBy === 'unforced_error') unforcedErrors[idx(p.winner) === 0 ? 1 : 0] += 1;
    if (p.tags.includes('break_point')) {
      bpChances[r] += 1;
      if (idx(p.winner) === r) bpWon[r] += 1;
    }
    rally += p.rallyLength;
  }
  return {
    aces,
    doubleFaults,
    firstServePct: [ratio(firstIn[0], served[0]), ratio(firstIn[1], served[1])],
    winners,
    unforcedErrors,
    breakPoints: [`${bpWon[0]}/${bpChances[0]}`, `${bpWon[1]}/${bpChances[1]}`],
    avgRally: ratio(rally, points.length),
  };
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);
