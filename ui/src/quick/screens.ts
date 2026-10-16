// Quick-match routes (ADR-016): #/quick (ladder), #/quick/match (the match), #/quick/result (after it).
import type { Ctx, Screen } from '../career/context.ts';
import { appSound } from '../audio/session.ts';
import { soundToggle } from '../audio/toggle.ts';
import { quickHome } from './home.ts';
import { quickMatchScreen } from './match.ts';
import { quickResult } from './result.ts';
import './quick.css';
import './quick-match.css';
import './quick-result.css';
import './quick-scout.css';
import './motion.css';
import './phone.css';

export async function quickScreen(ctx: Ctx, params: string[]): Promise<Screen> {
  // The crowd murmurs under a match only (ADR-029).
  appSound().setBed(params[0] === 'match');
  const screen = await (params[0] === 'match' ? quickMatchScreen(ctx) : params[0] === 'result' ? quickResult(ctx) : quickHome(ctx));
  const toggle = soundToggle();
  screen.element.append(toggle.element);
  return {
    ...screen,
    dispose() {
      toggle.dispose();
      screen.dispose?.();
    },
  };
}
