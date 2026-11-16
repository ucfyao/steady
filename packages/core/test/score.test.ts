import { describe, expect, it } from 'vitest';
import {
  SART_CONFIG,
  createSessionPlan,
  mulberry32,
  scoreSession,
  type TrialOutcome,
} from '../src/index.js';
import { perfect, submit } from './helpers.js';

const plan = createSessionPlan(2026);
// Derived from the spec, NOT from the implementation, so a broken rule can't
// silently change the expectation too: first 5 trials + 3 after each probe.
const TRANSITION = new Set<number>([
  0,
  1,
  2,
  3,
  4,
  ...plan.probeAfter.flatMap((p) => [p + 1, p + 2, p + 3]),
]);
const transition = (i: number) => TRANSITION.has(i);

/** Returns a, b, a, b, … on successive calls. */
const alternate = (a: number, b: number) => {
  let n = 0;
  return () => (n++ % 2 === 0 ? a : b);
};

// Reference values computed independently with Python's statistics.NormalDist
// Spec 005: 9 targets and 72 go trials.
const D_PRIME_PERFECT = 4.109924111630582; // Φ⁻¹(9.5/10) − Φ⁻¹(0.5/73)
const D_PRIME_PRESS_ALL = 0.8202168577276379; // Φ⁻¹(0.5/10) − Φ⁻¹(0.5/73)

describe('scoreSession', () => {
  it('scores a perfect player', () => {
    const s = scoreSession(plan, submit(plan, perfect(400)));
    expect(s.commissions).toBe(0);
    expect(s.omissions).toBe(0);
    expect(s.commissionRate).toBe(0);
    expect(s.omissionRate).toBe(0);
    expect(s.medianGoRtMs).toBe(400);
    expect(s.rtCv).toBe(0);
    expect(s.dPrime).toBeCloseTo(D_PRIME_PERFECT, 6);
    expect(s.longestSteadyRun).toBe(81);
    // A perfectly constant 400 ms is not human-like, so it is described as such
    expect(s.flags).toEqual(['regular_timing']);
    expect(s.scoringVersion).toBe(3);
  });

  describe('regular_timing flag (descriptive only)', () => {
    it('is raised for machine-like timing (CV < 0.05)', () => {
      const next = alternate(395, 405);
      // alternating 395/405 → CV ≈ 0.0126
      const s = scoreSession(
        plan,
        submit(plan, (t) => (t.isTarget ? null : next())),
      );
      expect(s.rtCv!).toBeLessThan(0.05);
      expect(s.flags).toContain('regular_timing');
    });

    it('is not raised for human-like variability', () => {
      const next = alternate(350, 450);
      // alternating 350/450 → CV ≈ 0.125
      const s = scoreSession(
        plan,
        submit(plan, (t) => (t.isTarget ? null : next())),
      );
      expect(s.rtCv!).toBeGreaterThan(0.1);
      expect(s.flags).not.toContain('regular_timing');
    });

    it('is not raised when there are too few RTs to compute CV', () => {
      const s = scoreSession(
        plan,
        submit(plan, () => null),
      );
      expect(s.rtCv).toBeNull();
      expect(s.flags).not.toContain('regular_timing');
    });

    it('does not invalidate or change any other metric', () => {
      const s = scoreSession(plan, submit(plan, perfect(400)));
      expect(s.dPrime).toBeCloseTo(D_PRIME_PERFECT, 6);
      expect(s.medianGoRtMs).toBe(400);
    });
  });

  it('scores a press-everything player', () => {
    const s = scoreSession(
      plan,
      submit(plan, () => 400),
    );
    expect(s.commissions).toBe(9);
    expect(s.commissionRate).toBe(1);
    // Not ≤ 0: with the log-linear correction and unequal trial counts (9 vs 72),
    // "no discrimination" lands slightly above zero. Still far below a perfect player.
    expect(s.dPrime).toBeCloseTo(D_PRIME_PRESS_ALL, 6);
  });

  it('scores a never-press player', () => {
    const s = scoreSession(
      plan,
      submit(plan, () => null),
    );
    expect(s.omissions).toBe(72);
    expect(s.omissionRate).toBe(1);
    expect(s.medianGoRtMs).toBeNull();
    expect(s.rtCv).toBeNull();
    expect(s.flags).toContain('high_omissions');
  });

  it('excludes transition trials from RT statistics', () => {
    const s = scoreSession(
      plan,
      submit(plan, (t) => (t.isTarget ? null : transition(t.index) ? 1100 : 400)),
    );
    expect(s.medianGoRtMs).toBe(400);
    expect(s.rtCv).toBe(0);
    expect(s.omissions).toBe(0);
  });

  it('counts anticipations, excludes them from RT, and flags when > 10% of presses', () => {
    const goSteady = plan.trials.filter((t) => !t.isTarget && !transition(t.index));
    const early = new Set(goSteady.slice(0, 20).map((t) => t.index));
    const s = scoreSession(
      plan,
      submit(plan, (t) => (t.isTarget ? null : early.has(t.index) ? 50 : 400)),
    );
    expect(s.anticipations).toBe(20);
    expect(s.omissions).toBe(0);
    expect(s.medianGoRtMs).toBe(400);
    expect(s.rtCv).toBe(0);
    expect(s.flags).toContain('many_anticipations');
  });

  it('does not flag a few anticipations', () => {
    const goSteady = plan.trials.filter((t) => !t.isTarget && !transition(t.index));
    const early = new Set(goSteady.slice(0, 5).map((t) => t.index));
    const s = scoreSession(
      plan,
      submit(plan, (t) => (t.isTarget ? null : early.has(t.index) ? 50 : 400)),
    );
    expect(s.flags).not.toContain('many_anticipations');
  });

  it('breaks the steady run at a commission', () => {
    const target = plan.trials.find((t) => t.isTarget && t.index > 30)!;
    const s = scoreSession(
      plan,
      submit(plan, (t) => (t.index === target.index ? 400 : perfect(400)(t))),
    );
    expect(s.commissions).toBe(1);
    expect(s.longestSteadyRun).toBe(Math.max(target.index, 80 - target.index));
  });

  it('breaks the steady run at an anticipation', () => {
    const go = plan.trials.find((t) => !t.isTarget && t.index > 30)!;
    const s = scoreSession(
      plan,
      submit(plan, (t) => (t.index === go.index ? 50 : perfect(400)(t))),
    );
    expect(s.anticipations).toBe(1);
    expect(s.omissions).toBe(0);
    expect(s.longestSteadyRun).toBe(Math.max(go.index, 80 - go.index));
  });

  describe('trialOutcomes (Spec 001, scoring version 2)', () => {
    it('labels each kind of trial as the spec defines it', () => {
      const targets = plan.trials.filter((t) => t.isTarget);
      const gos = plan.trials.filter((t) => !t.isTarget && t.index > 10);
      const caught = targets[0]!.index;
      const commission = targets[1]!.index;
      const anticipation = gos[0]!.index;
      const omission = gos[1]!.index;
      const rtFor = (i: number, isTarget: boolean): number | null => {
        if (i === commission || i === anticipation) return 50;
        if (i === omission) return null;
        return isTarget ? null : 400;
      };
      const s = scoreSession(
        plan,
        submit(plan, (t) => rtFor(t.index, t.isTarget)),
      );

      const expected = new Map<number, TrialOutcome>([
        [caught, 'caught'],
        [commission, 'commission'],
        [anticipation, 'anticipation'],
        [omission, 'omission'],
      ]);
      expect(s.trialOutcomes).toHaveLength(81);
      s.trialOutcomes.forEach((outcome, i) => {
        const want = expected.get(i) ?? (plan.trials[i]!.isTarget ? 'caught' : 'steady');
        expect(outcome, `trial ${i}`).toBe(want);
      });
    });

    it('agrees with longestSteadyRun for random submissions', () => {
      const rng = mulberry32(99);
      for (let k = 0; k < 200; k++) {
        const s = scoreSession(
          plan,
          submit(plan, () => {
            const r = rng();
            return r < 0.15 ? null : r < 0.2 ? 60 : 200 + Math.round(rng() * 700);
          }),
        );
        expect(s.trialOutcomes).toHaveLength(plan.trials.length);
        let best = 0;
        let run = 0;
        for (const o of s.trialOutcomes) {
          run = o === 'steady' || o === 'caught' ? run + 1 : 0;
          best = Math.max(best, run);
        }
        expect(s.longestSteadyRun).toBe(best);
      }
    });
  });

  it('computes RT stats when exactly 10 RTs qualify', () => {
    const allowed = new Set(
      plan.trials
        .filter((t) => !t.isTarget && !transition(t.index))
        .slice(0, 10)
        .map((t) => t.index),
    );
    const s = scoreSession(
      plan,
      submit(plan, (t) => (allowed.has(t.index) ? 400 : null)),
    );
    expect(s.medianGoRtMs).toBe(400);
    expect(s.rtCv).toBe(0);
  });

  it('returns null RT stats when fewer than 10 RTs qualify', () => {
    const allowed = new Set(
      plan.trials
        .filter((t) => !t.isTarget && !transition(t.index))
        .slice(0, 9)
        .map((t) => t.index),
    );
    const s = scoreSession(
      plan,
      submit(plan, (t) => (allowed.has(t.index) ? 400 : null)),
    );
    expect(s.medianGoRtMs).toBeNull();
    expect(s.rtCv).toBeNull();
  });

  describe('pre-probe variability', () => {
    it('is 0 for constant RTs and carries the probe answer', () => {
      const s = scoreSession(plan, submit(plan, perfect(400), 'drifting'));
      expect(s.probes).toHaveLength(3);
      s.probes.forEach((p, i) => {
        expect(p.afterIndex).toBe(plan.probeAfter[i]);
        expect(p.answer).toBe('drifting');
        expect(p.preProbeCv).toBe(0);
      });
    });

    it('is null when the window has too little data', () => {
      const s = scoreSession(
        plan,
        submit(plan, () => null),
      );
      s.probes.forEach((p) => expect(p.preProbeCv).toBeNull());
    });

    it('includes the probe trial itself in the window', () => {
      const first = plan.probeAfter[0]!;
      const s = scoreSession(
        plan,
        submit(plan, (t) => (t.isTarget ? null : t.index === first ? 800 : 400)),
      );
      expect(s.probes[0]!.preProbeCv).toBeGreaterThan(0);
    });

    it('rises only for the probe whose window was variable', () => {
      const first = plan.probeAfter[0]!;
      const window = new Set(
        Array.from({ length: SART_CONFIG.preProbeWindow }, (_, k) => first - k),
      );
      let flip = false;
      const s = scoreSession(
        plan,
        submit(plan, (t) => {
          if (t.isTarget) return null;
          if (!window.has(t.index)) return 400;
          flip = !flip;
          return flip ? 300 : 600;
        }),
      );
      expect(s.probes[0]!.preProbeCv).toBeGreaterThan(0.2);
      s.probes.slice(1).forEach((p) => expect(p.preProbeCv).toBe(0));
    });
  });
});
