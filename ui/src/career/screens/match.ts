// Watching a match (GDD §2): the user's live match set by set, with tactics between sets (TD-003), or a replay of
// an earlier match from its recipe. Loads the 3D code on demand (TD-014).
import { advance, finish, fingerprint, isOver, replayMatch, SCHEMA_VERSION, setTactic, startMatch, type MatchRecipe, type Tactic } from '@tennis/engine';
import { pendingUserMatch, playRound, quickRecipe } from '@tennis/game';
import { h } from '../../lib/h.ts';
import type { Ctx, Screen } from '../context.ts';
import { tacticControls } from './tournament.ts';

export async function matchScreen(ctx: Ctx, params: string[]): Promise<Screen> {
  const { mountBroadcast } = await import('../../replay/broadcast.ts');
  const stage = h('div');
  const bar = h('div', { class: 'match-bar' });
  const panel = h('div', { class: 'match-panel', id: 'match-panel', hidden: true });
  const element = h('div', { class: 'match-screen' }, stage, bar, panel);
  if (params[0] === 'replay') return replay(ctx, Number(params[1]), Number(params[2]), mountBroadcast, { element, stage, bar });

  const s = ctx.state!;
  const pending = pendingUserMatch(s);
  if (!pending) {
    ctx.go('#/tournament');
    return { element: h('div') };
  }
  const recipe: MatchRecipe = quickRecipe(pending, ctx.tactic);
  const live = startMatch(recipe.config, recipe.seed);
  const changes: MatchRecipe['tacticChanges'] = [];
  let sets = 0;
  let current: Tactic = recipe.config.tactics[0];
  let waiting = false;
  const input = () => ({ schemaVersion: SCHEMA_VERSION, config: live.config, events: [...live.events] });

  const broadcast = mountBroadcast(stage, {
    mode: 'full',
    onFrame: (_frame, clock, programme) => {
      if (waiting || clock.t < programme.totalSec - 1e-6) return;
      waiting = true;
      if (isOver(live)) showResult();
      else showSetBreak();
    },
  });
  const opponent = recipe.config.players[1].name;
  bar.append(h('span', null, `${recipe.config.players[0].name} v ${opponent}`),
    h('button', { id: 'skip', onclick: () => skipToEnd() }, 'Skip to the result'),
    h('button', { id: 'leave', onclick: () => ctx.go('#/tournament') }, 'Leave (match is not played)'));

  function playSet() {
    advance(live, 'set');
    sets++;
    broadcast.load(input(), { keepTime: sets > 1 });
    broadcast.dispatch({ type: 'play' });
    waiting = false;
    panel.hidden = true;
  }

  function showSetBreak() {
    ctx.tactic = { ...current };
    panel.replaceChildren(h('div', { id: 'set-break' },
      h('h3', null, `End of set ${sets}`),
      h('p', { class: 'muted' }, 'Change your tactics for the next set?'),
      tacticControls(ctx),
      h('div', { class: 'actions' }, h('button', { class: 'primary', id: 'next-set', onclick: () => {
        if (JSON.stringify(ctx.tactic) !== JSON.stringify(current)) {
          current = { ...ctx.tactic };
          setTactic(live, 'A', current);
          changes.push({ afterSet: sets, player: 'A', tactic: current });
        }
        playSet();
      } }, `Play set ${sets + 1}`))));
    panel.hidden = false;
  }

  function showResult() {
    const result = finish(live);
    // For the e2e tests: the match on screen, comparable with the engine run in Node.
    document.body.dataset.fingerprint = fingerprint(result);
    const won = result.winner === 'A';
    panel.replaceChildren(h('div', { id: 'match-result' },
      h('h3', null, won ? `You beat ${opponent}` : `${opponent} wins`),
      h('div', { class: 'actions' }, h('button', { class: 'primary', id: 'back-to-tournament', onclick: () => {
        ctx.set(playRound(ctx.state!, { ...recipe, tacticChanges: changes }), undefined, '#/tournament');
      } }, 'Back to the tournament'))));
    panel.hidden = false;
  }

  function skipToEnd() {
    if (!isOver(live)) {
      advance(live, 'match');
      broadcast.load(input(), { keepTime: true });
    }
    broadcast.dispatch({ type: 'seek', t: Number.MAX_SAFE_INTEGER });
    waiting = true;
    showResult();
  }

  playSet();
  return { element, bare: true, dispose: () => broadcast.dispose() };
}

type Mount = (typeof import('../../replay/broadcast.ts'))['mountBroadcast'];

function replay(ctx: Ctx, historyIndex: number, matchIndex: number, mount: Mount, dom: { element: HTMLElement; stage: HTMLElement; bar: HTMLElement }): Screen {
  const record = ctx.state!.history[historyIndex]?.userMatches[matchIndex];
  if (!record?.recipe) {
    ctx.go('#/home');
    return { element: h('div') };
  }
  const broadcast = mount(dom.stage, { mode: 'highlights' });
  const result = replayMatch(record.recipe);
  broadcast.load(result);
  broadcast.dispatch({ type: 'play' });
  document.body.dataset.fingerprint = fingerprint(result);
  const names = record.recipe.config.players.map((p) => p.name).join(' v ');
  dom.bar.append(h('span', null, `Replay · ${names} · ${record.score}`), h('button', { id: 'leave', onclick: () => ctx.go(`#/history/${historyIndex}`) }, 'Back'));
  return { element: dom.element, bare: true, dispose: () => broadcast.dispose() };
}
