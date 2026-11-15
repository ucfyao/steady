import type { PlanTrial, ProbeAnswer, SessionPlan, Submission } from '../src/index.js';

/** Build a submission by deciding the RT (or null for no press) of each trial. */
export function submit(
  plan: SessionPlan,
  rtFor: (trial: PlanTrial) => number | null,
  answer: ProbeAnswer = 'on_task',
): Submission {
  return {
    rts: plan.trials.map(rtFor),
    probeAnswers: plan.probeAfter.map(() => answer),
  };
}

/** Presses every go trial at `rt` ms and withholds on every target. */
export const perfect =
  (rt = 400) =>
  (t: PlanTrial) =>
    t.isTarget ? null : rt;
