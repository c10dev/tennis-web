// Report section for rematches (ADR-025, TD-034): the rival adapts to the head to head after one meeting.
import type { Row } from '../../engine/cli/report.ts';
import { fixedBot, randomBot, scoutBot } from '../src/quick/bots.ts';
import { readStats, rematch } from '../src/quick/read-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { check, fmt, info } from './quick-rows.ts';

const T = QUICK_TARGETS.rematch;
const LEADS = { user: 'you lead', rival: 'they lead' } as const;

export function rivalRows(n: number, seed: number): Row[] {
  return (['user', 'rival'] as const).flatMap((lead) => {
    const r = rematch(lead);
    const [scout, random] = [scoutBot, randomBot].map((b) => readStats(b, n, seed, r));
    const fixed = (['attack', 'defend', 'counter'] as const).map((c) => readStats(fixedBot(c), n, seed, r).win);
    return [
      info(`Rematch, ${LEADS[lead]}: scouting / random`, `${fmt(scout!.win, '%')} / ${fmt(random!.win, '%')} · habit played ${fmt(random!.habitShare, '%')}`),
      check(`  scouting minus random (pp)`, scout!.win - random!.win, T.scoutOverRandom, '%'),
      check(`  best fixed card (${fixed.map((w) => fmt(w, '%')).join(' / ')})`, Math.max(...fixed), T.fixedCardWin, '%'),
    ];
  });
}
