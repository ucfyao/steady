export const PROBE_ANSWERS = ['on_task', 'drifting', 'elsewhere'] as const;
export type ProbeAnswer = (typeof PROBE_ANSWERS)[number];

/** The one input method a session uses: Space on a keyboard, or tapping on a touch screen. */
export const INPUT_DEVICES = ['keyboard', 'touch'] as const;
export type InputDevice = (typeof INPUT_DEVICES)[number];

/**
 * The A/B split (Spec 006 §5): `calm` shows the lantern only; `game` adds points, the
 * multiplier, fireflies and dawn.
 */
export const VARIANTS = ['calm', 'game'] as const;
export type Variant = (typeof VARIANTS)[number];

export const SLEEP_LEVELS = ['poor', 'ok', 'good'] as const;
export const STRESS_LEVELS = ['low', 'medium', 'high'] as const;

/** Optional self-report before a session; either field may be left out. */
export interface CheckIn {
  sleep?: (typeof SLEEP_LEVELS)[number];
  stress?: (typeof STRESS_LEVELS)[number];
}

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

/** What happened on one trial (Spec 001), for the session-journey UI. */
export type TrialOutcome = 'steady' | 'anticipation' | 'omission' | 'caught' | 'commission';

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
  /** Game points from `scorePoints(trialOutcomes)` (scoring version 4, Spec 006). */
  points: number;
  /** One per trial, in plan order (scoring version 2). */
  trialOutcomes: TrialOutcome[];
  probes: ProbeResult[];
  flags: BehaviourFlag[];
}

export type ProgressMetric = 'commissionRate' | 'omissionRate' | 'medianGoRtMs' | 'rtCv';

/** One stored session, as progress needs it. Passed oldest first. */
export interface ProgressSession {
  score: Pick<SessionScore, ProgressMetric | 'probes'>;
  checkIn: CheckIn | null;
}

export interface MetricSummary {
  median: number | null;
  /** number of sessions with a non-null value */
  n: number;
}

export type MetricSet = Record<ProgressMetric, MetricSummary>;

export interface ProgressSummary {
  totalSessions: number;
  practiceSessions: number;
  sessionsUntilBaseline: number;
  baseline: MetricSet | null;
  recent: MetricSet | null;
}

export interface Group {
  key: string;
  n: number;
  values: number[];
  /** only reported when n reaches PROGRESS_CONFIG.minGroupSize */
  median: number | null;
}

export interface GroupComparison {
  groups: Group[];
  /** true only when at least two groups reach the minimum size */
  canSummarise: boolean;
}

// ---- API response shapes (Spec 003), shared with the web client ----

export interface StartedSession {
  id: string;
  startedAt: string;
  /** What this session shows (Spec 006). */
  variant: Variant;
  plan: Pick<SessionPlan, 'trials' | 'probeAfter'>;
}

export interface CompletedSession {
  id: string;
  startedAt: string;
  completedAt: string;
  checkIn: CheckIn | null;
  device: InputDevice;
  variant: Variant;
  score: SessionScore;
}

export interface ProgressResponse {
  summary: ProgressSummary;
  checkIn: Record<'sleep' | 'stress', Record<ProgressMetric, GroupComparison>>;
  preProbe: GroupComparison;
}
