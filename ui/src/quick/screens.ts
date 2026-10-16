// Quick-match routes (ADR-016): #/quick (ladder), #/quick/match (the match), #/quick/result (after it).
import type { Ctx, Screen } from '../career/context.ts';
import { quickHome } from './home.ts';
import { quickMatchScreen } from './match.ts';
import { quickResult } from './result.ts';
import './quick.css';
import './quick-match.css';
import './quick-result.css';
import './quick-scout.css';
import './motion.css';
import './phone.css';

export function quickScreen(ctx: Ctx, params: string[]): Screen | Promise<Screen> {
  if (params[0] === 'match') return quickMatchScreen(ctx);
  if (params[0] === 'result') return quickResult(ctx);
  return quickHome(ctx);
}
