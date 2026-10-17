// Report section owned by the match-flow workstream (ADR-017): length, decisions, pace, matchup weight, skill, ladder.
import type { Row } from '../../engine/cli/report.ts';
import { ladderPace, matchupEdge, median, percentile, share, skillLadder, type WinRate } from '../src/quick/balance.ts';
import { readerBot } from '../src/quick/bots.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { QUICK_MOMENTS } from '../src/tuning.ts';
import { check, fmt, info } from './quick-rows.ts';

const T = QUICK_TARGETS.flow;

export function flowRows(random: WinRate, n: number, seed: number, ladders: number): Row[] {
  const skill = skillLadder(Math.max(200, Math.floor(n / 4)), seed);
  return [
    check('Points per match (median)', median(random.points), T.medianPoints),
    check('Decisions per match (median)', median(random.decisions), T.medianDecisions),
    check('Matches with 2+ decisions', share(random.decisions, (d) => d >= 2), T.twoOrMoreDecisions, '%'),
    check('Most decisions in a match', Math.max(...random.decisions), T.maxDecisions),
    check('Decisions per match (90th percentile)', percentile(random.decisions, 0.9), T.p90Decisions),
    info('Matches stopped by the cap', fmt(share(random.decisions, (d) => d === QUICK_MOMENTS.maxDecisions), '%')),
    check('Seconds on screen per match (median)', median(random.seconds), T.medianSeconds, 's'),
    check('Same at the game pace (ADR-024, median)', median(random.gameSeconds), T.medianSeconds, 's'),
    check('Same in the hybrid edit (ADR-030, median)', median(random.hybridSeconds), T.medianHybridSeconds, 's'),
    check('Won matchup at a decision point (pp)', matchupEdge(Math.max(300, Math.floor(n / 2)), seed), T.matchupEdge, '%'),
    { label: 'Win % by rating 11..15 vs 13', value: skill.map((w) => `${(w * 100).toFixed(0)}`).join('/'), range: 'rising', status: skill.every((w, i) => i === 0 || w > skill[i - 1]!) ? 'PASS' : 'FAIL' },
    check('Places climbed in 30 matches', ladderPace(readerBot, ladders, 30, seed), T.ladderClimb30),
  ];
}
