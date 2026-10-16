// The game plan picker on the ladder (ADR-017): three toggles next to Play. The last plan is remembered. Against a
// specialist the plan that throws them off balance is marked and its tip shown under the buttons (ADR-025).
import { planChoices, type GamePlan } from '@tennis/game';
import { T, U } from '../i18n/index.ts';
import { h } from '../lib/h.ts';

const KEY = 'tennis-quick-plan';
const PLANS = planChoices(T);

function readPlan(): GamePlan {
  try {
    const saved = localStorage.getItem(KEY);
    return PLANS.find((p) => p.plan === saved)?.plan ?? PLANS.find((p) => p.default)!.plan;
  } catch {
    return PLANS.find((p) => p.default)!.plan;
  }
}

function savePlan(plan: GamePlan) {
  try {
    localStorage.setItem(KEY, plan);
  } catch {
    // Private windows may refuse storage; the choice then lasts for this page only.
  }
}

/** The plan an opponent's style tips and the line that says why (`opponentScouting().plan`). */
export type PlanTip = { plan: GamePlan; line: string } | null;

export function planPicker(tip: PlanTip = null): { element: HTMLElement; plan: () => GamePlan } {
  let plan = readPlan();
  const line = h('span', { class: 'muted plan-line', id: 'plan-line' });
  const buttons = PLANS.map((p) => h('button', {
    class: p.plan === tip?.plan ? 'plan-btn tipped' : 'plan-btn', id: `plan-${p.plan}`, type: 'button',
    'aria-describedby': p.plan === tip?.plan ? 'plan-tip' : null, onclick: () => select(p.plan),
  }, p.label));
  function select(next: GamePlan) {
    plan = next;
    savePlan(next);
    PLANS.forEach((p, i) => buttons[i]!.classList.toggle('selected', p.plan === next));
    line.textContent = PLANS.find((p) => p.plan === next)!.line;
  }
  select(plan);
  const element = h('div', { class: 'plan-picker', id: 'plan-picker' },
    h('span', { class: 'muted' }, U.gamePlan), h('div', { class: 'plan-buttons', role: 'group' }, buttons), line,
    tip ? h('p', { class: 'plan-tip', id: 'plan-tip' }, tip.line) : null);
  return { element, plan: () => plan };
}
