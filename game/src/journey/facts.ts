// What a swing report says, as facts the text templates pick from (ADR-032).
import { JTIERS, TIER_ORDER } from './calendar.ts';
import type { EventResult, JourneyState, SwingReport } from './types.ts';
import { particles, type Vars } from './vars.ts';

export interface Facts {
  /** The swing's best result: biggest tier first, then the furthest run. */
  best: EventResult | null;
  titles: EventResult[];
  majorTitle: boolean;
  majorFinal: boolean;
  majorSemi: boolean;
  juniorMajorTitle: boolean;
  /** Matches won and lost this swing. */
  won: number;
  lost: number;
  /** Rank change, positive up (null when either side is unranked). */
  climb: number | null;
  rank: number | null;
  injured: boolean;
  away: boolean;
  junior: boolean;
  age: number;
  vars: Vars;
}

/** "우승", "준우승", "4강", "16강"… for a run in an event. */
export function reached(r: Pick<EventResult, 'champion' | 'roundsWon' | 'rounds'>): string {
  if (r.champion) return '우승';
  if (r.roundsWon === r.rounds - 1) return '준우승';
  return `${2 ** (r.rounds - r.roundsWon)}강`;
}

export function facts(r: SwingReport, s: JourneyState): Facts {
  const order = (e: EventResult) => TIER_ORDER.indexOf(e.tier) * 10 - e.roundsWon;
  const best = [...r.events].sort((a, b) => order(a) - order(b))[0] ?? null;
  const titles = r.events.filter((e) => e.champion);
  const major = r.events.find((e) => e.tier === 'major');
  const matches = r.events.flatMap((e) => e.matches);
  const title = [...titles].sort((a, b) => order(a) - order(b))[0] ?? null;
  const about = (key: string, e: EventResult | null): Vars => {
    const last = e?.matches.at(-1);
    return { ...particles(key, e?.name ?? ''), ...particles(`${key}Opp`, last?.opponentName ?? '상대'), [`${key}Score`]: last?.score ?? '', ...particles(`${key}Reached`, e ? reached(e) : '') };
  };
  const climb = r.rankBefore !== null && r.rankAfter !== null ? r.rankBefore - r.rankAfter : null;
  return {
    best, titles,
    majorTitle: titles.some((e) => e.tier === 'major'),
    majorFinal: !!major && major.roundsWon >= major.rounds - 1,
    majorSemi: !!major && major.roundsWon === major.rounds - 2,
    juniorMajorTitle: titles.some((e) => e.tier === 'jrMajor'),
    won: matches.filter((m) => m.won).length,
    lost: matches.filter((m) => !m.won).length,
    climb, rank: r.rankAfter, injured: r.injured > 0, away: r.events.length === 0, junior: r.stage === 'junior', age: r.age,
    vars: {
      ...particles('name', s.user.player.name),
      short: shortName(s.user.player.name),
      ...about('event', best),
      ...about('title', title),
      ...about('major', major ?? null),
      tier: title ? TIER_LABEL[title.tier] : best ? TIER_LABEL[best.tier] : '',
      rank: r.rankAfter ?? '-',
      climb: Math.abs(climb ?? 0),
      titles: s.stats.titles,
      majors: s.stats.majors,
      age: r.age,
      won: matches.filter((m) => m.won).length,
      lost: matches.filter((m) => !m.won).length,
    },
  };
}

export const TIER_LABEL: Record<EventResult['tier'], string> = {
  jr: '주니어 대회', jrMajor: '주니어 메이저', futures: '퓨처스', challenger: '챌린저', t250: '투어 250', masters: '마스터스', major: '메이저', finals: '파이널스',
};

/** A Korean name's given name (김민준 → 민준) or a Western surname, as fans call players. */
export function shortName(name: string): string {
  if (name.includes(' ')) return name.split(' ').at(-1)!;
  return name.length >= 3 ? name.slice(1) : name;
}

export const bigTier = (e: EventResult): boolean => JTIERS[e.tier].points.at(-1)! >= 1000;
