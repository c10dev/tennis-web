// The game plan picker on the ladder (ADR-017): three toggles next to Play. The last plan is remembered.
import { planChoices, type GamePlan } from '@tennis/game';
import { h } from '../lib/h.ts';

const KEY = 'tennis-quick-plan';
const PLANS = planChoices();

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

export function planPicker(): { element: HTMLElement; plan: () => GamePlan } {
  let plan = readPlan();
  const line = h('span', { class: 'muted plan-line', id: 'plan-line' });
  const buttons = PLANS.map((p) => h('button', { class: 'plan-btn', id: `plan-${p.plan}`, type: 'button', onclick: () => select(p.plan) }, p.label));
  function select(next: GamePlan) {
    plan = next;
    savePlan(next);
    PLANS.forEach((p, i) => buttons[i]!.classList.toggle('selected', p.plan === next));
    line.textContent = PLANS.find((p) => p.plan === next)!.line;
  }
  select(plan);
  const element = h('div', { class: 'plan-picker', id: 'plan-picker' },
    h('span', { class: 'muted' }, 'Game plan'), h('div', { class: 'plan-buttons', role: 'group' }, buttons), line);
  return { element, plan: () => plan };
}
