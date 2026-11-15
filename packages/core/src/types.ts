export const PROBE_ANSWERS = ['on_task', 'drifting', 'elsewhere'] as const;
export type ProbeAnswer = (typeof PROBE_ANSWERS)[number];

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
  plan: Pick<SessionPlan, 'trials' | 'probeAfter'>;
}

export interface CompletedSession {
  id: string;
  startedAt: string;
  completedAt: string;
  checkIn: CheckIn | null;
  score: SessionScore;
}

export interface ProgressResponse {
  summary: ProgressSummary;
  checkIn: Record<'sleep' | 'stress', Record<ProgressMetric, GroupComparison>>;
  preProbe: GroupComparison;
}
