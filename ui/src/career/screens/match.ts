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
    ctx.redirect('#/tournament');
    return { element: h('div') };
  }
  const recipe: MatchRecipe = quickRecipe(pending, ctx.tactic);
  // A match left unplayed (Leave or Back) leaves the tactic as it was, not as set at a break.
  const before = { ...ctx.tactic };
  let recorded = false;
  const live = startMatch(recipe.config, recipe.seed);
  const changes: MatchRecipe['tacticChanges'] = [];
  let sets = 0;
  let current: Tactic = recipe.config.tactics[0];
  let waiting = false;
  let atBreak = false;
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
  // Like the broadcast's own buttons: one clicked with the mouse gives focus back, so Space plays and pauses again.
  bar.addEventListener('click', (e) => {
    if (e.detail > 0 && e.target instanceof HTMLElement) e.target.closest('button')?.blur();
  });

  function playSet() {
    // From the end of the set just shown, wherever the clock went at the break (Space there rewinds to the start).
    broadcast.dispatch({ type: 'seek', t: Number.MAX_SAFE_INTEGER });
    advance(live, 'set');
    sets++;
    atBreak = false;
    broadcast.load(input(), { keepTime: sets > 1 });
    broadcast.dispatch({ type: 'play' });
    waiting = false;
    panel.hidden = true;
  }

  /** The tactic picked at the break, for the sets still to come (by Play set or by Skip). */
  function applyTactic() {
    if (!atBreak || JSON.stringify(ctx.tactic) === JSON.stringify(current)) return;
    current = { ...ctx.tactic };
    setTactic(live, 'A', current);
    changes.push({ afterSet: sets, player: 'A', tactic: current });
  }

  function showSetBreak() {
    atBreak = true;
    ctx.tactic = { ...current };
    panel.replaceChildren(h('div', { id: 'set-break' },
      h('h3', null, `End of set ${sets}`),
      h('p', { class: 'muted' }, 'Change your tactics for the next set?'),
      tacticControls(ctx),
      h('div', { class: 'actions' }, h('button', { class: 'primary', id: 'next-set', onclick: () => {
        applyTactic();
        playSet();
      } }, `Play set ${sets + 1}`))));
    panel.hidden = false;
  }

  function showResult() {
    const result = finish(live);
    // For the e2e tests: the match on screen, comparable with the engine run in Node.
    document.body.dataset.fingerprint = fingerprint(result);
    const won = result.winner === 'A';
    // The result is in: leaving now would undo a loss.
    bar.querySelector<HTMLElement>('#leave')!.hidden = true;
    panel.replaceChildren(h('div', { id: 'match-result' },
      h('h3', null, won ? `You beat ${opponent}` : `${opponent} wins`),
      h('div', { class: 'actions' }, h('button', { class: 'primary', id: 'back-to-tournament', onclick: (e: Event) => {
        // Once, from the season this match belongs to: a second click must not play another round.
        (e.currentTarget as HTMLButtonElement).disabled = true;
        // In place of this page: Back must not land on the match screen, which would start the next round.
        recorded = true;
        if (ctx.state === s) ctx.set(playRound(s, { ...recipe, tacticChanges: changes }), undefined, '#/tournament', { replace: true });
      } }, 'Back to the tournament'))));
    panel.hidden = false;
  }

  function skipToEnd() {
    applyTactic();
    atBreak = false;
    if (!isOver(live)) {
      advance(live, 'match');
      broadcast.load(input(), { keepTime: true });
    }
    broadcast.dispatch({ type: 'seek', t: Number.MAX_SAFE_INTEGER });
    waiting = true;
    showResult();
  }

  playSet();
  return {
    element,
    bare: true,
    dispose: () => {
      if (!recorded) ctx.tactic = before;
      broadcast.dispose();
    },
  };
}

type Mount = (typeof import('../../replay/broadcast.ts'))['mountBroadcast'];

function replay(ctx: Ctx, historyIndex: number, matchIndex: number, mount: Mount, dom: { element: HTMLElement; stage: HTMLElement; bar: HTMLElement }): Screen {
  const record = ctx.state!.history[historyIndex]?.userMatches[matchIndex];
  if (!record?.recipe) {
    ctx.redirect('#/home');
    return { element: h('div') };
  }
  const broadcast = mount(dom.stage, { mode: 'highlights' });
  const result = replayMatch(record.recipe);
  broadcast.load(result);
  broadcast.dispatch({ type: 'play' });
  document.body.dataset.fingerprint = fingerprint(result);
  const names = record.recipe.config.players.map((p) => p.name).join(' v ');
  dom.bar.append(h('span', null, `Replay · ${names} · ${record.score}`), h('button', { id: 'leave', onclick: () => ctx.redirect(`#/history/${historyIndex}`) }, 'Back'));
  return { element: dom.element, bare: true, dispose: () => broadcast.dispose() };
}
