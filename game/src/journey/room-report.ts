// The room's page after a swing (ADR-033): who leads among friends, every match they played against each other, the
// swing's best player and the cup. Korean only (TD-080).
import { ovr } from './ratings.ts';
import { rankOf } from './ranking.ts';
import type { MatchLine, RoomState, SwingReport } from './types.ts';

export interface Standing {
  id: string;
  name: string;
  rank: number | null;
  /** Places gained (positive) this swing; null when unranked on either side. */
  change: number | null;
  /** Ranking points won this season (this year's swings). */
  seasonPoints: number;
  seasonTitles: number;
  ovr: number;
  cups: number;
}

export interface Meeting {
  winner: string;
  loser: string;
  winnerName: string;
  loserName: string;
  /** "룸 컵 결승", "부산 챌린저 16강"… */
  where: string;
  /** Games from the winner's side. */
  score: string;
  line: MatchLine;
}

export interface RoomReport {
  standings: Standing[];
  meetings: Meeting[];
  mvp: { id: string; name: string; points: number } | null;
  cupWinner: string | null;
  feed: string[];
}

/** The round a match was played in: "결승", "4강", "16강"… */
const roundName = (round: number, rounds: number) => (round >= rounds ? '결승' : `${2 ** (rounds - round + 1)}강`);

export function roomReport(room: RoomState, reports: Readonly<Record<string, SwingReport>>): RoomReport {
  const name = (id: string) => room.humans[id]?.user.player.name ?? id;
  const year = Object.values(reports)[0]?.year ?? room.year;
  const standings: Standing[] = room.order.map((id) => {
    const h = room.humans[id]!;
    const season = h.reports.filter((r) => r.year === year);
    const rank = rankOf(h.user.player, room.pros, room.points);
    const before = reports[id]?.rankBefore ?? null;
    return {
      id, name: name(id), rank, change: rank !== null && before !== null ? before - rank : null,
      seasonPoints: season.reduce((a, r) => a + r.events.reduce((b, e) => b + e.points, 0), 0),
      seasonTitles: season.reduce((a, r) => a + r.events.filter((e) => e.champion).length, 0),
      ovr: ovr(h.user.player), cups: h.reports.filter((r) => r.cup?.champion).length,
    };
  }).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.seasonPoints - a.seasonPoints || (a.id < b.id ? -1 : 1));

  const meetings: Meeting[] = [];
  const meet = (id: string, m: MatchLine, where: string) => {
    if (!m.opponent.startsWith('h:') || !m.won) return;
    meetings.push({ winner: id, loser: m.opponent, winnerName: name(id), loserName: name(m.opponent), where, score: m.score, line: m });
  };
  const cupRounds = Math.max(0, ...Object.values(reports).flatMap((r) => r.cup?.matches.map((m) => m.round) ?? []));
  for (const [id, r] of Object.entries(reports)) {
    for (const e of r.events) for (const m of e.matches) meet(id, m, `${e.name} ${roundName(m.round, e.rounds)}`);
    for (const m of r.cup?.matches ?? []) meet(id, m, `룸 컵 ${roundName(m.round, cupRounds)}`);
  }

  const earned = Object.entries(reports).map(([id, r]) => ({ id, name: name(id), points: r.events.reduce((a, e) => a + e.points, 0) }))
    .sort((a, b) => b.points - a.points || (a.id < b.id ? -1 : 1));
  const mvp = earned[0] && earned[0].points > 0 ? earned[0] : null;
  const cupWinner = Object.entries(reports).find(([, r]) => r.cup?.champion)?.[0] ?? null;
  const feed = [
    ...(cupWinner ? [`룸 컵 우승: ${name(cupWinner)}`] : []),
    ...(mvp ? [`이번 구간 MVP: ${mvp.name} (랭킹 포인트 ${mvp.points})`] : []),
    ...meetings.map((m) => `${m.winnerName} ${m.score} ${m.loserName} · ${m.where}`),
  ];
  return { standings, meetings, mvp, cupWinner: cupWinner ? name(cupWinner) : null, feed };
}
