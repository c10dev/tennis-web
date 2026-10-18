// AI-vs-AI matches for the text career (ADR-032): each point a coin weighted by the server's level over the
// returner's, played through real games, sets and tiebreaks. Fitted to engine batches (journey/tuning.ts FAST);
// the user's own matches always run the full engine.
import type { Rng, Surface } from '@tennis/engine';
import { FAST } from './tuning.ts';

export interface FastResult {
  winner: 'A' | 'B';
  /** Games per set, A first. */
  sets: [number, number][];
}

/** Chance the server wins a point, from both players' levels (overall on the 1–20 scale, adjusted). */
export function serveWin(server: number, returner: number, surface: Surface): number {
  const mean = (server + returner) / 2;
  return FAST.serve + FAST.perLevel * (mean - FAST.pivot) + FAST.perGap * (server - returner) + FAST.surface[surface];
}

/** A player's level for the fast model: overall, plus surface affinity, less starting fatigue. */
export function fastLevel(overall: number, affinity: number, fatigue: number): number {
  return overall + FAST.affinity * (affinity - 13) - Math.min(FAST.fatigueCap, FAST.fatigue * fatigue);
}

export function fastMatch(a: number, b: number, surface: Surface, bestOf: 3 | 5, rng: Rng): FastResult {
  const p = { A: serveWin(a, b, surface), B: serveWin(b, a, surface) };
  const need = (bestOf + 1) / 2;
  const sets: [number, number][] = [];
  let server: 'A' | 'B' = rng.next() < 0.5 ? 'A' : 'B';
  let won = { A: 0, B: 0 };
  while (won.A < need && won.B < need) {
    const games = { A: 0, B: 0 };
    for (;;) {
      if (games.A === 6 && games.B === 6) {
        const tb = race(7, server, p, rng, true);
        games[tb]++;
        server = other(server);
        break;
      }
      const hold = race(4, server, p, rng, false) === server;
      games[hold ? server : other(server)]++;
      server = other(server);
      const [hi, lo] = games.A > games.B ? [games.A, games.B] : [games.B, games.A];
      if (hi >= 6 && hi - lo >= 2) break;
    }
    sets.push([games.A, games.B]);
    won = games.A > games.B ? { ...won, A: won.A + 1 } : { ...won, B: won.B + 1 };
  }
  return { winner: won.A === need ? 'A' : 'B', sets };
}

/** First to `target` points, two clear. A game keeps one server; a tiebreak switches after the first point, then every two. */
function race(target: number, first: 'A' | 'B', p: Record<'A' | 'B', number>, rng: Rng, tiebreak: boolean): 'A' | 'B' {
  const pts = { A: 0, B: 0 };
  for (let n = 0; ; n++) {
    const server = tiebreak && Math.floor((n + 1) / 2) % 2 === 1 ? other(first) : first;
    const point = rng.next() < p[server] ? server : other(server);
    pts[point]++;
    const lead = pts.A - pts.B;
    if (pts.A >= target && lead >= 2) return 'A';
    if (pts.B >= target && lead <= -2) return 'B';
  }
}

const other = (s: 'A' | 'B'): 'A' | 'B' => (s === 'A' ? 'B' : 'A');
