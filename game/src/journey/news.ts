// A swing's press and community (ADR-032): a lead headline from the most notable thing that happened, a second one
// from the next, and a handful of comments from what fits. Seeded, so a report reads the same when reopened.
import { pick, stream } from '../rng.ts';
import { facts } from './facts.ts';
import { MILESTONES, NICKS, TEMPLATES, type Tone } from './news-ko.ts';
import type { JourneyState, SwingReport } from './types.ts';
import { fill } from './vars.ts';

export interface Headline {
  text: string;
  tone: Tone;
}

export interface Comment {
  nick: string;
  text: string;
  likes: number;
}

export interface Press {
  headlines: Headline[];
  comments: Comment[];
  toasts: string[];
}

/** `s` is the state the report came from (names, totals). */
export function press(r: SwingReport, s: JourneyState): Press {
  const f = facts(r, s);
  const rng = stream(s.seed, 'news', r.year, r.swing);
  const fits = TEMPLATES.filter((t) => t.when(f));
  const headlines = fits.slice(0, 2).map((t) => ({ text: fill(pick(rng, t.news), f.vars), tone: t.tone }));
  const pool = fits.slice(0, 3).flatMap((t) => t.comments);
  const comments: Comment[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 12 && comments.length < 4 && used.size < pool.length; i++) {
    const text = pick(rng, pool);
    if (used.has(text)) continue;
    used.add(text);
    comments.push({ nick: `${pick(rng, NICKS)}${Math.floor(rng.next() * 900) + 10}`, text: fill(text, f.vars), likes: Math.floor(rng.next() ** 2 * 400) });
  }
  comments.sort((a, b) => b.likes - a.likes);
  return { headlines, comments, toasts: r.milestones.map((m) => MILESTONES[m] ?? m) };
}
