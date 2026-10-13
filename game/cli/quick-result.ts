// Report section owned by the result-screen workstream (ADR-017): rewards that show, the decisive moment.
import type { Row } from '../../engine/cli/report.ts';
import { readerBot } from '../src/quick/bots.ts';
import { resultStats } from '../src/quick/result-balance.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { check, info } from './quick-rows.ts';

const T = QUICK_TARGETS.result;

/** Over the same ladders as the climb row (the reader bot, 30 matches each). */
export function resultRows(seed: number, ladders: number): Row[] {
  const r = resultStats(readerBot, ladders, 30, seed);
  return [
    check('Won matches with a visible rating gain', r.visibleWins / r.wins, T.visibleGainOnWin, '%'),
    check('Lost matches with a visible rating gain', r.visibleLosses / (r.matches - r.wins), T.visibleGainOnLoss, '%'),
    check('Decisive moment found', r.decisiveFound / r.withDecision, T.decisiveFound, '%'),
    info('Shown rating points per match (mean)', (r.shownGain / r.matches).toFixed(2)),
    info('Players passed per match (mean)', (r.overtakes / r.matches).toFixed(2)),
  ];
}
