// A swing's write-up for one player (ADR-032/033): a lead headline from the most notable thing that happened, a
// second from the next, what the team says, and milestone toasts. Seeded, so a report reads the same when reopened.
import { pick, stream } from '../rng.ts';
import { facts } from './facts.ts';
import { MILESTONES, TEMPLATES, type Tone } from './news-ko.ts';
import { staffLines, type StaffLine } from './staff-voice.ts';
import type { JourneyState, SwingReport } from './types.ts';
import { fill } from './vars.ts';

export interface Headline {
  text: string;
  tone: Tone;
}

export interface Press {
  headlines: Headline[];
  staff: StaffLine[];
  toasts: string[];
}

/** `s` is the player's state the report came from (names, totals, the team after the swing). */
export function press(r: SwingReport, s: JourneyState): Press {
  const f = facts(r, s);
  const rng = stream(s.seed, 'news', r.year, r.swing, s.user.player.id);
  const fits = TEMPLATES.filter((t) => t.when(f));
  const headlines = fits.slice(0, 2).map((t) => ({ text: fill(pick(rng, t.news), f.vars), tone: t.tone }));
  return { headlines, staff: staffLines(r, s.user.team, s.seed), toasts: r.milestones.map((m) => MILESTONES[m] ?? m) };
}
