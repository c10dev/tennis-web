import { describe, expect, it } from 'vitest';
import type { PlayStyle } from '@tennis/engine';
import { startQuick } from '../src/quick/match.ts';
import { opponentTactic, PLANS, planTactic, planTip } from '../src/quick/plan.ts';
import { ko } from '../src/text/ko.ts';
import { opponentScouting } from '../src/views/quick-scout.ts';
import { freshLadder } from './quick-helpers.ts';

const TIPPED: PlayStyle[] = ['big_server', 'baseliner', 'counter_puncher'];

describe('plans against styles (TD-031)', () => {
  it('names one plan for each of the three specialist styles, every plan once, and none for an all-court player', () => {
    expect(TIPPED.map(planTip).sort()).toEqual([...PLANS].sort());
    expect(planTip('all_court')).toBeNull();
  });

  it('has an all-court opponent match the tempo of the user\'s plan', () => {
    const [a, b, d] = PLANS.map((p) => opponentTactic('all_court', p).aggression);
    expect(a).toBeGreaterThan(b!);
    expect(b).toBe(0.5);
    expect(d).toBeLessThan(b!);
  });

  it('throws a specialist off balance with its plan (less aggression than the tempo), and lifts it against the others', () => {
    for (const style of TIPPED) {
      for (const plan of PLANS) {
        const mirror = opponentTactic('all_court', plan).aggression;
        const own = opponentTactic(style, plan).aggression;
        if (plan === planTip(style)) expect(own).toBeLessThan(mirror);
        else expect(own).toBeGreaterThan(mirror);
        expect(own).toBeGreaterThanOrEqual(0);
        expect(own).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the rest of the opponent\'s tactic as the balanced plan\'s', () => {
    expect({ ...opponentTactic('baseliner', 'defensive'), aggression: 0 }).toEqual({ ...planTactic('balanced'), aggression: 0 });
  });

  it('is what a ladder match plays on its points without cards', () => {
    const s = freshLadder(4);
    for (const plan of PLANS) {
      const m = startQuick(s, plan);
      const [me, them] = m.recipe.config.tactics;
      expect(me).toEqual(planTactic(plan));
      expect(them).toEqual(opponentTactic(m.recipe.config.players[1].style, plan));
    }
  });
});

describe('the plan tip on the ladder home (TD-031)', () => {
  it('names the plan that suits the next opponent\'s style, or nothing for an all-court player', () => {
    let tipped = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = freshLadder(seed);
      const id = startQuick(s).opponent;
      const style = s.world.players.find((p) => p.id === id)!.style;
      const tip = planTip(style);
      const { plan } = opponentScouting(s, id);
      const { plan: koPlan } = opponentScouting(s, id, ko);
      if (!tip) {
        expect(plan).toBeNull();
        continue;
      }
      tipped++;
      expect(plan).toContain(['Aggressive', 'Balanced', 'Defensive'][PLANS.indexOf(tip)]);
      expect(koPlan).toContain(ko.plan[tip].label);
    }
    expect(tipped).toBeGreaterThan(0);
  });
});
