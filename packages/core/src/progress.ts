/**
 * Progress for one player (Spec 002). Input is that player's stored sessions,
 * oldest first. Session 1 is practice: plotted by the UI, never compared here.
 */
import { PROGRESS_CONFIG as P } from './config.js';
import { median } from './stats.js';
import {
  PROBE_ANSWERS,
  SLEEP_LEVELS,
  STRESS_LEVELS,
  type GroupComparison,
  type MetricSet,
  type MetricSummary,
  type ProgressMetric,
  type ProgressSession,
  type ProgressSummary,
} from './types.js';

const METRICS: readonly ProgressMetric[] = [
  'commissionRate',
  'omissionRate',
  'medianGoRtMs',
  'rtCv',
];
const LEVELS = { sleep: SLEEP_LEVELS, stress: STRESS_LEVELS } as const;

const nonNull = (xs: readonly (number | null)[]) => xs.filter((x): x is number => x !== null);

function summarise(values: readonly (number | null)[]): MetricSummary {
  const xs = nonNull(values);
  return { median: xs.length ? median(xs) : null, n: xs.length };
}

function metricSet(sessions: readonly ProgressSession[]): MetricSet {
  const entries = METRICS.map((m) => [m, summarise(sessions.map((s) => s.score[m]))] as const);
  return Object.fromEntries(entries) as MetricSet;
}

function compare(keys: readonly string[], valuesFor: (key: string) => number[]): GroupComparison {
  const groups = keys.map((key) => {
    const values = valuesFor(key);
    const n = values.length;
    return { key, n, values, median: n >= P.minGroupSize ? median(values) : null };
  });
  const bigEnough = groups.filter((g) => g.n >= P.minGroupSize).length;
  return { groups, canSummarise: bigEnough >= 2 };
}

const afterPractice = (sessions: readonly ProgressSession[]) => sessions.slice(P.practiceSessions);

export function summariseProgress(sessions: readonly ProgressSession[]): ProgressSummary {
  const scored = afterPractice(sessions);
  const hasBaseline = scored.length >= P.baselineSessions;
  return {
    totalSessions: sessions.length,
    practiceSessions: Math.min(sessions.length, P.practiceSessions),
    sessionsUntilBaseline: Math.max(0, P.practiceSessions + P.baselineSessions - sessions.length),
    baseline: hasBaseline ? metricSet(scored.slice(0, P.baselineSessions)) : null,
    recent: hasBaseline ? metricSet(scored.slice(-P.recentSessions)) : null,
  };
}

export function compareByCheckIn(
  sessions: readonly ProgressSession[],
  dimension: keyof typeof LEVELS,
  metric: ProgressMetric,
): GroupComparison {
  const scored = afterPractice(sessions);
  return compare(LEVELS[dimension], (level) =>
    nonNull(scored.filter((s) => s.checkIn?.[dimension] === level).map((s) => s.score[metric])),
  );
}

export function comparePreProbe(sessions: readonly ProgressSession[]): GroupComparison {
  const probes = afterPractice(sessions).flatMap((s) => s.score.probes);
  return compare(PROBE_ANSWERS, (answer) =>
    nonNull(probes.filter((p) => p.answer === answer).map((p) => p.preProbeCv)),
  );
}
