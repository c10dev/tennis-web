// Quick-match routes (ADR-016): #/quick (ladder), #/quick/match (the match), #/quick/result (after it).
import type { Ctx, Screen } from '../career/context.ts';
import { appSound } from '../lib/sound.ts';
import { quickHome } from './home.ts';
import { quickMatchScreen } from './match.ts';
import { quickResult } from './result.ts';
import { soundToggle } from './sound-toggle.ts';
import './quick.css';
import './quick-match.css';
import './quick-result.css';
import './quick-scout.css';
import './motion.css';

export async function quickScreen(ctx: Ctx, params: string[]): Promise<Screen> {
  const sound = appSound();
  // The crowd murmurs under a match only (ADR-023).
  sound.setBed(params[0] === 'match');
  const screen = await (params[0] === 'match' ? quickMatchScreen(ctx) : params[0] === 'result' ? quickResult(ctx) : quickHome(ctx));
  screen.element.append(soundToggle(sound));
  return screen;
}
