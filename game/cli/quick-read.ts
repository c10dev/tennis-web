// Report section owned by the opponent-read workstream (ADR-017): habits, tells, no dominant card.
import type { Row } from '../../engine/cli/report.ts';
import { cardEntropy, type WinRate } from '../src/quick/balance.ts';
import { exploitBot, fixedBot, habitBot, randomBot, scoutBot, tellBot } from '../src/quick/bots.ts';
import { readStats, type ReadStats } from '../src/quick/read-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { check, fmt, info } from './quick-rows.ts';

const T = QUICK_TARGETS.read;
const pct = (v: number) => fmt(v, '%');
const matchups = (s: ReadStats) => `won ${pct(s.beat)} / lost ${pct(s.beaten)}`;

export function readRows(random: WinRate, n: number, seed: number): Row[] {
  const [scout, habit, tell, ceiling, base] = [scoutBot, habitBot, tellBot, exploitBot, randomBot].map((b) => readStats(b, n, seed)) as [ReadStats, ReadStats, ReadStats, ReadStats, ReadStats];
  return [
    check('Knows the habit and style (scouting)', scout.win, T.habitWin, '%'),
    info('  decision matchups', matchups(scout)),
    info('Knows the habit only', `${pct(habit.win)} · ${matchups(habit)}`),
    info('Knows the AI\'s odds (ceiling)', `${pct(ceiling.win)} · ${matchups(ceiling)}`),
    check('Follows the tells', tell.win, T.tellWin, '%'),
    info('  decision matchups', matchups(tell)),
    check('Random cards', random.win, T.randomWin, '%'),
    ...(['attack', 'defend', 'counter'] as const).map((c) => check(`Always ${c}`, readStats(fixedBot(c), n, seed).win, T.fixedCardWin, '%')),
    check('Habit card when the habit applies', base.habitShare, T.habitShare, '%'),
    info('Decisions where the habit applies', pct(base.habitApplies)),
    ...Object.entries(base.byHabit).map(([h, c]) => info(`  ${h}`, `applies ${pct(c.applies / c.decisions)} · played ${pct(c.played / c.applies)}`)),
    info('AI card entropy at decisions', `${cardEntropy(random.aiCards).toFixed(2)} b`),
  ];
}
