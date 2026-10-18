// The books after a swing (ADR-032): the user's growth, fatigue and injuries, morale, reputation and money, career
// stats and the milestones the text layer turns into headlines.
import type { SwingEnd } from './condition.ts';
import { growUser } from './growth.ts';
import type { Plan } from './plan.ts';
import { rankOf } from './ranking.ts';
import { groupValues, ovr } from './ratings.ts';
import { BOOKS, STAGES } from './tuning.ts';
import type { CareerStats, EventResult, JourneyState, SwingReport } from './types.ts';

export interface SettleInput {
  plan: Plan;
  results: EventResult[];
  /** Planned events the user could not get into. */
  skipped: string[];
  end: SwingEnd;
  rankBefore: number | null;
  juniorRankBefore: number | null;
  withUser: boolean;
}

/** `before` is the state the swing started from; `after` has the world's points and growth already. */
export function settle(before: JourneyState, after: JourneyState, { plan, results, skipped, end, rankBefore, juniorRankBefore, withUser }: SettleInput): { state: JourneyState; report: SwingReport } {
  const u = before.user;
  const wasInjured = u.injury > 0;
  const grown = withUser ? growUser(u.player, { coach: u.coach, morale: u.morale, matches: end.matches, trainWeeks: end.trainWeeks, injured: wasInjured || end.hurt > 0, focus: plan.focus }) : u.player;
  const hurt = withUser ? end.hurt : 0;
  const player = { ...grown, fatigue: end.fatigue, injuryWeeks: 0 };
  const rankAfter = withUser ? rankOf(player, after.pros, after.points) : null;
  const juniorRankAfter = withUser && u.stage === 'junior' ? rankOf(player, after.juniors, after.juniorPoints) : null;
  const prize = results.reduce((a, r) => a + r.prize, 0);
  const pro = u.stage === 'pro';
  const money = u.money + prize + (u.sponsor?.fee ?? 0) - (pro ? BOOKS.coachFee[u.coach] : 0) - BOOKS.living[pro ? 'pro' : 'junior']
    + (u.stage === 'college' ? STAGES.collegeStipend : 0);
  const stats = tally(before.stats, results, rankAfter, juniorRankAfter, prize);
  const user = {
    ...u, player, money,
    injury: wasInjured ? u.injury - 1 : hurt,
    away: wasInjured ? (u.injury > 1 ? u.away : undefined) : hurt ? 'injury' as const : undefined,
    focus: plan.focus,
    morale: clamp(morale(u.morale, results, rankBefore, rankAfter)),
    reputation: clamp(u.reputation * BOOKS.reputationKeep + results.reduce((a, r) => a + r.points, 0) / BOOKS.pointsPerReputation
      + results.filter((r) => r.champion && r.tier === 'major').length * BOOKS.majorReputation),
    sponsor: u.sponsor && u.sponsor.swings > 1 ? { ...u.sponsor, swings: u.sponsor.swings - 1 } : null,
    peak: Math.max(u.peak, ovr(player)),
    college: u.stage === 'college' ? Math.max(0, u.college - 1) : u.college,
    wildcard: false,
  };
  const milestones = withUser ? reached(before.stats, stats, results, before.seen) : [];
  const report: SwingReport = {
    year: before.year, swing: before.swing, age: u.player.age, stage: u.stage, events: results,
    rankBefore, rankAfter, juniorRankBefore, juniorRankAfter,
    ovrBefore: ovr(u.player), ovrAfter: ovr(player), groupsBefore: groupValues(u.player), groupsAfter: groupValues(player),
    injured: hurt, milestones, money: money - u.money, skipped, fatigue: end.fatigue, trainWeeks: end.trainWeeks,
  };
  const seen = [...before.seen, ...milestones.map((m) => `m:${m}`)];
  return { state: { ...after, user, stats, seen, reports: withUser ? [...before.reports, report] : before.reports, notes: [] }, report };
}

function morale(m: number, results: readonly EventResult[], before: number | null, after: number | null): number {
  let v = m + (BOOKS.moraleRest - m) * BOOKS.moraleDrift;
  for (const r of results) {
    if (r.champion) v += r.tier === 'major' ? BOOKS.morale.majorTitle : BOOKS.morale.title;
    else if (r.roundsWon === r.rounds - 1) v += BOOKS.morale.final;
    if (r.matches.length === 1 && !r.matches[0]!.won) v += BOOKS.morale.firstRoundLoss;
  }
  if (before !== null && after !== null) v += after < before ? BOOKS.morale.rankUp : after > before ? BOOKS.morale.rankDown : 0;
  return v;
}

function tally(s: CareerStats, results: readonly EventResult[], rank: number | null, juniorRank: number | null, prize: number): CareerStats {
  const out: CareerStats = { ...s, h2h: { ...s.h2h }, majorWins: [...s.majorWins], prize: s.prize + prize };
  for (const r of results) {
    for (const m of r.matches) {
      if (m.won) out.wins++;
      else out.losses++;
      if (!m.opponent.startsWith('f:')) {
        const [w, l] = out.h2h[m.opponent] ?? [0, 0];
        out.h2h[m.opponent] = m.won ? [w + 1, l] : [w, l + 1];
      }
    }
    if (r.roundsWon >= r.rounds - 1 && !r.tier.startsWith('jr')) out.finals++;
    if (!r.champion) continue;
    if (r.tier === 'jr' || r.tier === 'jrMajor') out.juniorTitles++;
    else out.titles++;
    if (r.tier === 'jrMajor') out.juniorMajors++;
    if (r.tier === 'major') {
      out.majors++;
      out.majorWins.push(r.name);
    }
  }
  if (rank !== null) out.bestRank = Math.min(out.bestRank ?? rank, rank);
  if (juniorRank !== null) out.bestJuniorRank = Math.min(out.bestJuniorRank ?? juniorRank, juniorRank);
  if (rank === 1) out.swingsAtOne++;
  return out;
}

/** Milestones reached for the first time this swing. */
function reached(was: CareerStats, now: CareerStats, results: readonly EventResult[], seen: readonly string[]): string[] {
  const hits: string[] = [];
  const once = (id: string, cond: boolean) => cond && !seen.includes(`m:${id}`) && hits.push(id);
  once('first-win', was.wins === 0 && now.wins > 0);
  once('first-junior-title', now.juniorTitles > was.juniorTitles);
  once('junior-major', now.juniorMajors > was.juniorMajors);
  once('junior-no1', now.bestJuniorRank === 1);
  once('first-pro-points', now.bestRank !== null);
  once('first-title', now.titles > was.titles);
  once('major-main-draw', results.some((r) => r.tier === 'major'));
  once('masters-title', results.some((r) => r.champion && r.tier === 'masters'));
  once('major-final', results.some((r) => r.tier === 'major' && r.roundsWon >= r.rounds - 1));
  once('major-title', now.majors > was.majors);
  once('finals', results.some((r) => r.tier === 'finals'));
  for (const top of [100, 50, 10, 1]) once(`top${top}`, now.bestRank !== null && now.bestRank <= top);
  return hits;
}

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
