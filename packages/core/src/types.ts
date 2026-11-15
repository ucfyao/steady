export const PROBE_ANSWERS = ['on_task', 'drifting', 'elsewhere'] as const;
export type ProbeAnswer = (typeof PROBE_ANSWERS)[number];

export interface PlanTrial {
  index: number;
  digit: number;
  isTarget: boolean;
  /** 0-based index into the font-size scale */
  fontSize: number;
}

export interface SessionPlan {
  seed: number;
  trials: PlanTrial[];
  /** The probe is shown after the trial at each of these indices. */
  probeAfter: number[];
}

export interface Submission {
  /** ms from stimulus onset to the first key press, or null for no press */
  rts: (number | null)[];
  probeAnswers: ProbeAnswer[];
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type BehaviourFlag = 'high_omissions' | 'many_anticipations' | 'regular_timing';

export interface ProbeResult {
  afterIndex: number;
  answer: ProbeAnswer;
  preProbeCv: number | null;
}

export interface SessionScore {
  scoringVersion: number;
  commissions: number;
  commissionRate: number;
  omissions: number;
  omissionRate: number;
  anticipations: number;
  medianGoRtMs: number | null;
  rtCv: number | null;
  dPrime: number;
  longestSteadyRun: number;
  probes: ProbeResult[];
  flags: BehaviourFlag[];
}
