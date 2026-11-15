import { SART_CONFIG as C } from './config.js';
import { coefficientOfVariation, median, probit } from './stats.js';
import type {
  BehaviourFlag,
  SessionPlan,
  SessionScore,
  Submission,
  TrialOutcome,
} from './types.js';

/** Warm-up and post-probe trials: kept for accuracy, excluded from RT statistics. */
export function isTransitionTrial(index: number, probeAfter: readonly number[]): boolean {
  if (index < C.warmupTrials) return true;
  return probeAfter.some((p) => index > p && index <= p + C.postProbeTrials);
}

/** Expects a submission that passed validateSubmission. */
export function scoreSession(plan: SessionPlan, submission: Submission): SessionScore {
  const { trials, probeAfter } = plan;
  const { rts } = submission;

  const pressed = (i: number) => rts[i] !== null && rts[i] !== undefined;
  const anticipated = (i: number) => pressed(i) && rts[i]! < C.anticipationMs;
  const inRtSet = (i: number) =>
    !trials[i]!.isTarget && pressed(i) && !anticipated(i) && !isTransitionTrial(i, probeAfter);

  const targets = trials.filter((t) => t.isTarget);
  const goTrials = trials.filter((t) => !t.isTarget);

  const commissions = targets.filter((t) => pressed(t.index)).length;
  const omissions = goTrials.filter((t) => !pressed(t.index)).length;
  const presses = trials.filter((t) => pressed(t.index)).length;
  const anticipations = trials.filter((t) => anticipated(t.index)).length;

  const rtSet = trials.filter((t) => inRtSet(t.index)).map((t) => rts[t.index]!);
  const enoughRts = rtSet.length >= C.minRtTrials;

  // d′ with "withhold" as the response; log-linear correction (Hautus 1995)
  const hits = targets.length - commissions;
  const falseAlarms = omissions;
  const H = (hits + 0.5) / (targets.length + 1);
  const F = (falseAlarms + 0.5) / (goTrials.length + 1);

  const trialOutcomes = trials.map((t): TrialOutcome => {
    if (t.isTarget) return pressed(t.index) ? 'commission' : 'caught';
    if (!pressed(t.index)) return 'omission';
    return anticipated(t.index) ? 'anticipation' : 'steady';
  });

  let longestSteadyRun = 0;
  let run = 0;
  for (const outcome of trialOutcomes) {
    run = outcome === 'steady' || outcome === 'caught' ? run + 1 : 0;
    longestSteadyRun = Math.max(longestSteadyRun, run);
  }

  const probes = probeAfter.map((p, k) => {
    const windowRts: number[] = [];
    for (let i = Math.max(0, p - C.preProbeWindow + 1); i <= p; i++) {
      if (inRtSet(i)) windowRts.push(rts[i]!);
    }
    return {
      afterIndex: p,
      answer: submission.probeAnswers[k]!,
      preProbeCv:
        windowRts.length >= C.preProbeMinTrials ? coefficientOfVariation(windowRts) : null,
    };
  });

  const omissionRate = omissions / goTrials.length;
  const flags: BehaviourFlag[] = [];
  if (omissionRate > C.flagHighOmissionRate) flags.push('high_omissions');
  if (presses > 0 && anticipations / presses > C.flagAnticipationShare)
    flags.push('many_anticipations');
  const rtCv = enoughRts ? coefficientOfVariation(rtSet) : null;
  if (rtCv !== null && rtCv < C.flagRegularTimingCv) flags.push('regular_timing');

  return {
    scoringVersion: C.scoringVersion,
    commissions,
    commissionRate: commissions / targets.length,
    omissions,
    omissionRate,
    anticipations,
    medianGoRtMs: enoughRts ? median(rtSet) : null,
    rtCv,
    dPrime: probit(H) - probit(F),
    longestSteadyRun,
    trialOutcomes,
    probes,
    flags,
  };
}
