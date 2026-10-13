// Report section owned by the result-screen workstream (ADR-017): rewards that show, the decisive moment.
import type { Row } from '../../engine/cli/report.ts';
import { QUICK_TARGETS } from '../src/quick/targets.ts';
import { notYet } from './quick-rows.ts';

const T = QUICK_TARGETS.result;

export function resultRows(): Row[] {
  return [notYet('Won matches with a visible rating gain', T.visibleGainOnWin, '%'), notYet('Decisive moment found', T.decisiveFound, '%')];
}
