import { describe, expect, it } from 'vitest';
import { pressureIndex, runtime } from '../src/player/condition.ts';
import { playerWith } from '../src/player/presets.ts';
import { errorProbability, shotQualityMean, winnerProbability } from '../src/point/outcome.ts';
import { serveOdds } from '../src/point/serve.ts';
import { riskWeights, targetWeights } from '../src/point/shotSelection.ts';
import type { PlayerAttributes, Surface, Tactic } from '../src/types.ts';

const TACTIC: Tactic = { aggression: 0.5, netApproach: 0, targetBackhand: false, serveTarget: 'mix' };
type Key = Exclude<keyof PlayerAttributes, 'surfaceAffinity'>;
const rt = (ratings: Partial<Record<Key, number>> = {}, tactic: Partial<Tactic> = {}, fatigue = 0) =>
  runtime(playerWith('P', ratings), { ...TACTIC, ...tactic }, 'A', 'hard', fatigue);
const RATINGS = [1, 5, 9, 13, 17, 20];

function increasing(values: number[]) {
  for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
}
function inUnit(p: number) {
  expect(p).toBeGreaterThanOrEqual(0);
  expect(p).toBeLessThanOrEqual(1);
}

describe('serve', () => {
  const odds = (server = rt(), returner = rt(), n: 1 | 2 = 1, surface: Surface = 'hard') =>
    serveOdds(server, returner, n, 'wide', surface, 0);

  it('probabilities stay in [0, 1] at the extremes', () => {
    for (const r of [1, 20]) {
      const o = odds(rt({ servePower: r, serveAccuracy: r, secondServe: r }), rt({ return: 21 - r }));
      inUnit(o.pIn);
      inUnit(o.pAce);
      inUnit(o.quality);
    }
  });

  it('accuracy raises first-serve in %, second-serve skill raises second-serve in %', () => {
    increasing(RATINGS.map((r) => odds(rt({ serveAccuracy: r })).pIn));
    increasing(RATINGS.map((r) => odds(rt({ secondServe: r }), rt(), 2).pIn));
  });

  it('power raises aces and serve quality; the return rating lowers aces', () => {
    increasing(RATINGS.map((r) => odds(rt({ servePower: r })).pAce));
    increasing(RATINGS.map((r) => odds(rt({ servePower: r })).quality));
    increasing(RATINGS.map((r) => -odds(rt(), rt({ return: r })).pAce));
  });

  it('second serves go in more often and make fewer aces than first serves', () => {
    expect(odds(rt(), rt(), 2).pIn).toBeGreaterThan(odds().pIn);
    expect(odds(rt(), rt(), 2).pAce).toBeLessThan(odds().pAce);
  });

  it('aces: grass > hard > clay', () => {
    const [g, h, c] = (['grass', 'hard', 'clay'] as const).map((s) => odds(rt(), rt(), 1, s).pAce);
    expect(g).toBeGreaterThan(h!);
    expect(h).toBeGreaterThan(c!);
  });
});

describe('rally outcome', () => {
  const err = (o: Partial<Parameters<typeof errorProbability>[0]> = {}) =>
    errorProbability({ skill: 0.632, risk: 'neutral', incoming: 0.5, fatigue: 0, pressure: 0, composure: 0.632, surface: 'hard', ...o });

  it('error probability falls with skill and rises with risk, incoming pace, fatigue and pressure', () => {
    increasing([1, 0.8, 0.6, 0.4, 0.2, 0].map((skill) => err({ skill })));
    increasing((['safe', 'neutral', 'aggressive'] as const).map((risk) => err({ risk })));
    increasing([0, 0.25, 0.5, 0.75, 1].map((incoming) => err({ incoming })));
    increasing([0, 0.3, 0.6, 1].map((fatigue) => err({ fatigue })));
    increasing([0, 0.3, 0.6, 1].map((pressure) => err({ pressure, composure: 0.3 })));
    expect(err({ pressure: 1, composure: 1 })).toBeLessThan(err({ pressure: 1, composure: 0.2 }));
    for (const skill of [0, 1]) for (const incoming of [0, 1]) inUnit(err({ skill, incoming, fatigue: 1, pressure: 1, risk: 'aggressive' }));
  });

  it('aggressive shots are better and win more points outright', () => {
    const q = (['safe', 'neutral', 'aggressive'] as const).map((risk) => shotQualityMean(0.632, risk, 0.5, 'hard'));
    increasing(q);
    increasing(q.map((quality) => winnerProbability(quality, rt(), 'hard')));
  });

  it('a fast defender concedes fewer winners; a hard incoming ball lowers shot quality', () => {
    increasing(RATINGS.map((r) => -winnerProbability(0.7, rt({ movement: r, agility: r }), 'hard')));
    increasing([1, 0.75, 0.5, 0.25, 0].map((incoming) => shotQualityMean(0.632, 'neutral', incoming, 'hard')));
  });

  it('tired defenders concede more winners', () => {
    expect(winnerProbability(0.7, rt({}, {}, 0.8), 'hard')).toBeGreaterThan(winnerProbability(0.7, rt(), 'hard'));
  });
});

describe('shot selection', () => {
  it('more aggression means more aggressive shots, fewer safe ones', () => {
    const low = riskWeights(rt({ aggression: 1 }, { aggression: 0 }), 0.5);
    const high = riskWeights(rt({ aggression: 20 }, { aggression: 1 }), 0.5);
    const share = (w: typeof low, k: keyof typeof low) => w[k] / (w.safe + w.neutral + w.aggressive);
    expect(share(high, 'aggressive')).toBeGreaterThan(share(low, 'aggressive'));
    expect(share(high, 'safe')).toBeLessThan(share(low, 'safe'));
  });

  it('good decisions play safer against a hard ball', () => {
    const smart = rt({ decision: 20 });
    const share = (w: ReturnType<typeof riskWeights>) => w.safe / (w.safe + w.neutral + w.aggressive);
    expect(share(riskWeights(smart, 0.9))).toBeGreaterThan(share(riskWeights(smart, 0.1)));
  });

  it('targetBackhand and a weak opponent backhand both pull shots to the backhand', () => {
    const plain = targetWeights(rt(), rt());
    const tactic = targetWeights(rt({}, { targetBackhand: true }), rt());
    const weakBh = targetWeights(rt({ decision: 18 }), rt({ backhand: 6 }));
    const share = (w: typeof plain) => w.backhand / (w.forehand + w.backhand + w.middle);
    expect(share(tactic)).toBeGreaterThan(share(plain));
    expect(share(weakBh)).toBeGreaterThan(share(plain));
  });
});

describe('pressure', () => {
  it('is zero on an ordinary point, higher on big points, capped at 1', () => {
    expect(pressureIndex([], false)).toBe(0);
    increasing([pressureIndex(['tiebreak'], false), pressureIndex(['break_point'], false), pressureIndex(['match_point'], false)]);
    expect(pressureIndex(['break_point', 'set_point', 'match_point', 'tiebreak'], true)).toBe(1);
    expect(pressureIndex([], true)).toBeGreaterThan(0);
  });
});
