import { describe, expect, it } from 'vitest';
import {
  createPointsCounter,
  createSessionPlan,
  maxPoints,
  mulberry32,
  pointsSoFar,
  scorePoints,
  scoreSession,
  trialOutcome,
  type TrialOutcome,
} from '../src/index.js';
import { perfect, submit } from './helpers.js';

const times = (n: number, o: TrialOutcome): TrialOutcome[] => Array<TrialOutcome>(n).fill(o);

// Every expected value is worked out by hand from Spec 006 §2: base 10 (steady) or 30
// (caught) × multiplier 1 for the 1st–4th correct trial in a row, 2 from the 5th, 3 from the
// 15th, 5 from the 30th; any slip resets the streak, never the points.
describe('scorePoints', () => {
  it('is 0 for no trials', () => {
    expect(scorePoints([])).toBe(0);
  });

  it('pays 10 per steady press before the first step', () => {
    expect(scorePoints(times(4, 'steady'))).toBe(40);
  });

  it('doubles from the 5th correct trial in a row', () => {
    expect(scorePoints(times(5, 'steady'))).toBe(60);
  });

  it('pays 30 for a caught 3, times the multiplier', () => {
    expect(scorePoints([...times(4, 'steady'), 'caught'])).toBe(100);
  });

  it('resets the streak after a slip but keeps the points', () => {
    expect(scorePoints([...times(6, 'steady'), 'commission', ...times(5, 'steady')])).toBe(140);
  });

  it('reaches ×3 at 15 and ×5 at 30', () => {
    expect(scorePoints(times(30, 'steady'))).toBe(740);
  });

  it('never pays for an omission or an anticipation', () => {
    expect(scorePoints(['omission', 'anticipation', 'commission'])).toBe(0);
    expect(scorePoints([...times(4, 'steady'), 'anticipation', 'steady'])).toBe(50);
  });
});

describe('createPointsCounter', () => {
  it('reports what each trial earned, the streak and the multiplier', () => {
    const c = createPointsCounter();
    const steps = [...times(5, 'steady'), 'omission' as const, 'caught' as const].map((o) =>
      c.add(o),
    );
    expect(steps.map((s) => s.gained)).toEqual([10, 10, 10, 10, 20, 0, 30]);
    expect(steps.map((s) => s.streak)).toEqual([1, 2, 3, 4, 5, 0, 1]);
    expect(steps.map((s) => s.multiplier)).toEqual([1, 1, 1, 1, 2, 1, 1]);
    expect(steps.at(-1)!.total).toBe(90);
  });

  it('gives the same total as scorePoints', () => {
    const outcomes: TrialOutcome[] = [
      ...times(20, 'steady'),
      'caught',
      'omission',
      ...times(40, 'steady'),
    ];
    const c = createPointsCounter();
    let total = 0;
    for (const o of outcomes) total = c.add(o).total;
    expect(total).toBe(scorePoints(outcomes));
  });
});

describe('maxPoints', () => {
  it('is the points of a session with every trial correct', () => {
    const plan = createSessionPlan(11);
    const all = plan.trials.map((t): TrialOutcome => (t.isTarget ? 'caught' : 'steady'));
    expect(maxPoints(plan.trials)).toBe(scorePoints(all));
  });
});

describe('points are never part of the score', () => {
  it('are not stored with the score; they come from its trial outcomes', () => {
    const plan = createSessionPlan(5);
    const s = scoreSession(plan, submit(plan, perfect(400)));
    expect(s).not.toHaveProperty('points');
    expect(scorePoints(s.trialOutcomes)).toBe(maxPoints(plan.trials));
    expect(s.scoringVersion).toBe(3);
  });
});

describe('trialOutcome: one rule for the server and the live display', () => {
  it('matches scoreSession on every trial of random sessions', () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 50; k++) {
      const plan = createSessionPlan(100 + k);
      const sub = submit(plan, () => {
        const r = rng();
        return r < 0.1 ? null : r < 0.15 ? 40 : 200 + r * 600;
      });
      const s = scoreSession(plan, sub);
      plan.trials.forEach((t, i) =>
        expect(trialOutcome(t.isTarget, sub.rts[i]!)).toBe(s.trialOutcomes[i]),
      );
    }
  });

  it('follows Spec 001: a 3 pressed at any RT is a commission; under 100 ms on a digit is too early', () => {
    expect(trialOutcome(true, null)).toBe('caught');
    expect(trialOutcome(true, 50)).toBe('commission');
    expect(trialOutcome(false, null)).toBe('omission');
    expect(trialOutcome(false, 99)).toBe('anticipation');
    expect(trialOutcome(false, 100)).toBe('steady');
  });
});

describe('pointsSoFar', () => {
  it('is the last step of the counter over the outcomes so far', () => {
    expect(pointsSoFar([])).toEqual({ gained: 0, total: 0, streak: 0, multiplier: 1 });
    expect(pointsSoFar([...times(4, 'steady'), 'caught'])).toEqual({
      gained: 60,
      total: 100,
      streak: 5,
      multiplier: 2,
    });
  });
});

describe('maxPoints from outcomes', () => {
  it('needs only which trials were 3s', () => {
    // 4 go then a 3: 4 × 10 + 30 × 2 = 100 (Spec 006 §2)
    const trials = [false, false, false, false, true].map((isTarget) => ({ isTarget }));
    expect(maxPoints(trials)).toBe(100);
  });
});
