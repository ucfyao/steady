import { GAME_CONFIG as G } from './config.js';
import type { PlanTrial, TrialOutcome } from './types.js';

export interface PointsStep {
  /** What this trial earned. */
  gained: number;
  total: number;
  /** Correct trials in a row, including this one (0 after a slip). */
  streak: number;
  /** The multiplier that applied to this trial (1 after a slip). */
  multiplier: number;
}

export interface PointsCounter {
  add(outcome: TrialOutcome): PointsStep;
}

const multiplierFor = (streak: number): number => {
  let m = 1;
  for (const [from, x] of G.multiplierSteps) if (streak >= from) m = x;
  return m;
};

/**
 * Game points, trial by trial (Spec 006 §2). The same counter drives the live display in the
 * browser and `scorePoints` on the server, so there is only one rule.
 */
export function createPointsCounter(): PointsCounter {
  let total = 0;
  let streak = 0;
  return {
    add(outcome) {
      const base =
        outcome === 'steady' ? G.steadyPoints : outcome === 'caught' ? G.caughtPoints : 0;
      if (base === 0) {
        streak = 0;
        return { gained: 0, total, streak, multiplier: 1 };
      }
      streak += 1;
      const multiplier = multiplierFor(streak);
      const gained = base * multiplier;
      total += gained;
      return { gained, total, streak, multiplier };
    },
  };
}

export function scorePoints(outcomes: readonly TrialOutcome[]): number {
  const counter = createPointsCounter();
  let total = 0;
  for (const o of outcomes) total = counter.add(o).total;
  return total;
}

/** The points of a session in which every trial is correct (only `isTarget` is read). */
export function maxPoints(trials: readonly Pick<PlanTrial, 'isTarget'>[]): number {
  return scorePoints(trials.map((t) => (t.isTarget ? 'caught' : 'steady')));
}
