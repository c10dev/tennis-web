// Report section owned by the opponent-read workstream (ADR-017): habits, tells, no dominant card.
import type { Row } from '../../engine/cli/report.ts';
import { cardEntropy, winRate, type WinRate } from '../src/quick/balance.ts';
import { exploitBot, fixedBot, tellBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { check, info, notYet } from './quick-rows.ts';

const T = QUICK_TARGETS.read;

export function readRows(random: WinRate, n: number, seed: number): Row[] {
  return [
    check('Knows the habit (ceiling)', winRate(exploitBot, n, seed).win, T.habitWin, '%'),
    check('Follows the tells', winRate(tellBot, n, seed).win, T.tellWin, '%'),
    check('Random cards', random.win, T.randomWin, '%'),
    ...(['attack', 'defend', 'counter'] as const).map((c) => check(`Always ${c}`, winRate(fixedBot(c), n, seed).win, T.fixedCardWin, '%')),
    notYet('Habit card when the habit applies', T.habitShare, '%'),
    info('AI card entropy at decisions', `${cardEntropy(random.aiCards).toFixed(2)} b`),
  ];
}
