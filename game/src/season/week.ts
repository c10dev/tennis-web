// The week: plans and the draw at the start, everyone's week applied at the close (GDD §9.3–9.4).
import { CALENDAR, tournamentInWeek } from '../calendar/schedule.ts';
import { pointsFor, TIERS } from '../calendar/tiers.ts';
import { USER_ID } from '../player/create.ts';
import { canPlay, endWeek, type WeekActivity } from '../player/week.ts';
import { stream } from '../rng.ts';
import { champion, roundsWon, startBracket } from '../tournament/bracket.ts';
import { makeDraw } from '../tournament/draw.ts';
import { entryList } from '../tournament/entry.ts';
import { aiChoice } from './ai.ts';
import { currentRanking, playerById, type SeasonState, type TournamentRecord, type UserChoice } from './state.ts';

export interface WeekPreview {
  week: number;
  tournament: ReturnType<typeof tournamentInWeek>;
  /** Where the user would stand on the entry list if they entered, and the cut. */
  entry: { position: number; cut: number; accepted: boolean } | null;
  canPlay: boolean;
}

export const seasonOver = (s: SeasonState): boolean => s.week > CALENDAR.weeks;

export function weekPreview(s: SeasonState): WeekPreview {
  const t = tournamentInWeek(s.week);
  const user = playerById(s, USER_ID);
  if (!t) return { week: s.week, tournament: null, entry: null, canPlay: canPlay(user) };
  const plans = planAll(s, { kind: 'enter' });
  const wanting = currentRanking(s).filter((id) => plans[id]!.kind === 'enter' && canPlay(playerById(s, id)));
  const position = wanting.indexOf(USER_ID) + 1;
  const cut = TIERS[t.tier].draw;
  return { week: s.week, tournament: t, entry: { position, cut, accepted: position > 0 && position <= cut }, canPlay: canPlay(user) };
}

function planAll(s: SeasonState, user: UserChoice): Record<string, UserChoice> {
  return Object.fromEntries(s.world.players.map((p) => [p.id, p.id === USER_ID ? user : aiChoice(s, p.id)]));
}

export function beginWeek(s: SeasonState, choice: UserChoice): SeasonState {
  if (s.tournament) throw new Error('The week has already begun');
  if (seasonOver(s)) throw new Error('The season is over');
  if (choice.kind !== 'rest' && !canPlay(playerById(s, USER_ID))) throw new Error('The player is injured and can only rest');
  const plans = planAll(s, choice);
  const t = tournamentInWeek(s.week);
  if (!t) return { ...s, plans: restUnplaced(plans, new Set()) };
  const entrants = entryList(currentRanking(s), (id) => plans[id]!.kind === 'enter' && canPlay(playerById(s, id)), TIERS[t.tier].draw);
  const slots = makeDraw(entrants, TIERS[t.tier].draw, stream(s.seed, 'draw', s.week));
  const tournament = { tournament: t, bracket: startBracket(slots), matches: [], setsPlayed: {}, done: false };
  return { ...s, plans: restUnplaced(plans, new Set(entrants)), tournament };
}

/** Anyone who wanted to play but is not in the draw rests instead. */
function restUnplaced(plans: Record<string, UserChoice>, entrants: Set<string>): Record<string, UserChoice> {
  return Object.fromEntries(Object.entries(plans).map(([id, p]) => [id, p.kind === 'enter' && !entrants.has(id) ? { kind: 'rest' } : p]));
}

export function closeWeek(s: SeasonState): SeasonState {
  const t = s.tournament;
  if (t && !t.done) throw new Error('There are still matches to play this week');
  const standings = { ...s.standings };
  const lastPlayed = { ...s.lastPlayed };
  const history = [...s.history];
  const entrants = new Set(t ? t.bracket.rounds[0]!.filter((x): x is string => x !== null) : []);
  if (t) {
    const won = Object.fromEntries([...entrants].map((id) => [id, roundsWon(t.bracket, id)]));
    for (const [id, r] of Object.entries(won)) {
      const pts = pointsFor(t.tournament.tier, r);
      standings[id] = { ...standings[id]!, season: standings[id]!.season + pts, prize: standings[id]!.prize + pts * TIERS[t.tournament.tier].prizePerPoint };
      lastPlayed[id] = s.week;
    }
    const record: TournamentRecord = {
      id: t.tournament.id, name: t.tournament.name, week: s.week, tier: t.tournament.tier, surface: t.tournament.surface,
      champion: champion(t.bracket)!, roundsWon: won, userMatches: t.matches.filter((m) => m.a === USER_ID || m.b === USER_ID),
    };
    history.push(record);
  }
  const injuries = { ...s.injuries };
  const players = s.world.players.map((p) => {
    const plan = s.plans[p.id] ?? { kind: 'rest' };
    const activity: WeekActivity = entrants.has(p.id)
      ? { kind: 'tournament', sets: t!.setsPlayed[p.id] ?? 0, travelled: s.lastPlayed[p.id] === s.week - 1 }
      : plan.kind === 'train' && canPlay(p) ? plan : { kind: 'rest' };
    const next = endWeek(p, activity, stream(s.seed, 'week', s.week, p.id));
    if (next.injuryWeeks > 0 && p.injuryWeeks === 0) injuries[p.id] = (injuries[p.id] ?? 0) + 1;
    return next;
  });
  const week = s.week + 1;
  const aged = week > CALENDAR.weeks ? players.map((p) => ({ ...p, age: p.age + 1 })) : players;
  return { ...s, week, world: { ...s.world, players: aged }, standings, lastPlayed, history, injuries, plans: {}, tournament: null };
}
