// The dashboard: the player, this week's choices (and why one is closed), the season calendar.
import { CALENDAR } from '../calendar/schedule.ts';
import { TIERS } from '../calendar/tiers.ts';
import { USER_ID } from '../player/create.ts';
import { overall } from '../player/overall.ts';
import { rankingPoints } from '../ranking.ts';
import { currentRanking, playerById, type SeasonState } from '../season/state.ts';
import { seasonOver, weekPreview } from '../season/week.ts';
import { fatigueLabel, money, ordinal, resultLabel, SURFACE_LABEL } from './format.ts';

export interface Option {
  enabled: boolean;
  note?: string;
}

export function homeView(s: SeasonState) {
  const me = playerById(s, USER_ID);
  const preview = weekPreview(s);
  const injured = me.injuryWeeks > 0 ? `Injured: ${me.injuryWeeks} more week${me.injuryWeeks === 1 ? '' : 's'}` : null;
  const t = preview.tournament;
  let enter: Option;
  if (!t) enter = { enabled: false, note: 'No tournament this week' };
  else if (injured) enter = { enabled: false, note: injured };
  else if (!preview.entry!.accepted) enter = { enabled: false, note: `Entry list: ${ordinal(preview.entry!.position)}, cut ${preview.entry!.cut}` };
  else enter = { enabled: true, note: `Entry list: ${ordinal(preview.entry!.position)} of ${preview.entry!.cut}` };
  return {
    week: s.week,
    weeks: CALENDAR.weeks,
    seasonOver: seasonOver(s),
    player: {
      name: me.name, rank: currentRanking(s).indexOf(USER_ID) + 1, points: rankingPoints(s.standings[USER_ID]!, s.week - 1),
      overall: Math.round(overall(me) * 10) / 10, fatigue: me.fatigue, fatigueLabel: fatigueLabel(me.fatigue), injuryWeeks: me.injuryWeeks,
      prize: money(s.standings[USER_ID]!.prize),
    },
    thisWeek: { tournament: t ? { name: t.name, tier: TIERS[t.tier].label, surface: SURFACE_LABEL[t.surface], draw: TIERS[t.tier].draw } : null },
    options: { enter, train: injured ? { enabled: false, note: injured } : { enabled: true }, rest: { enabled: true } as Option },
    inTournament: s.tournament !== null,
    calendar: CALENDAR.tournaments.map((x) => {
      const past = s.history.find((h) => h.id === x.id);
      const status = x.week < s.week ? 'past' : x.week === s.week ? 'current' : 'upcoming';
      const won = past?.roundsWon[USER_ID];
      return {
        week: x.week, name: x.name, tier: TIERS[x.tier].label, surface: SURFACE_LABEL[x.surface], status,
        ...(status === 'past' ? { result: won === undefined ? 'Did not play' : resultLabel(TIERS[x.tier].draw, won) } : {}),
      };
    }),
  };
}

export type HomeView = ReturnType<typeof homeView>;
