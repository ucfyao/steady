/**
 * What each progress metric means to a player (Spec 004): a plain name and one sentence,
 * the research term as small print, which way is better, and how a value compares with a
 * reference. Shared by Results and Progress. Values are always the server's; nothing here
 * scores a session.
 */
import {
  PROGRESS_CONFIG,
  median,
  type CompletedSession,
  type ProgressMetric,
  type ProgressSummary,
} from '@steady/core';

/** Which way is better, in shown units. `null`: neither (speed trades off against errors). */
export type Better = 'higher' | 'lower' | null;

export interface MetricDef {
  key: ProgressMetric;
  /** Plain name, e.g. "3s held back". */
  name: string;
  /** One sentence in plain words. */
  description: string;
  /** The research term, for small print. */
  term: string;
  better: Better;
  /** The server's value as shown: commission rate is shown as catch rate (Spec 002). */
  show(value: number): number;
  format(shown: number): string;
  /** The skill in a sentence: "Better than where you started at {phrase}." */
  phrase: string;
  /** A change in the shown value, in words. */
  moved: { up: string; down: string };
}

const percent = (x: number) => `${Math.round(x * 100)}%`;

export const METRICS: Record<ProgressMetric, MetricDef> = {
  commissionRate: {
    key: 'commissionRate',
    name: '3s held back',
    description: "Of the 3s, how many you didn't press.",
    term: 'Catch rate (1 − commission errors)',
    better: 'higher',
    show: (v) => 1 - v,
    format: percent,
    phrase: 'holding back on 3s',
    moved: { up: 'More held back', down: 'Fewer held back' },
  },
  omissionRate: {
    key: 'omissionRate',
    name: 'Digits missed',
    description: 'Digits you let pass without pressing.',
    term: 'Omission errors',
    better: 'lower',
    show: (v) => v,
    format: percent,
    phrase: 'catching every digit',
    moved: { up: 'More missed', down: 'Fewer missed' },
  },
  medianGoRtMs: {
    key: 'medianGoRtMs',
    name: 'Typical response time',
    description: 'How quickly you usually pressed. Faster is not better if it brings more errors.',
    term: 'Median response time',
    better: null,
    show: (v) => v,
    format: (x) => `${Math.round(x)} ms`,
    phrase: 'response time',
    moved: { up: 'Slower', down: 'Faster' },
  },
  rtCv: {
    key: 'rtCv',
    name: 'How much your timing varied',
    description: 'Lower means a more even rhythm.',
    term: 'Rhythm variability (RT CV)',
    better: 'lower',
    show: (v) => v,
    format: percent,
    phrase: 'keeping an even rhythm',
    moved: { up: 'Less even', down: 'More even' },
  },
};

/** The order metrics are listed in: accuracy first, then speed next to variability. */
export const METRIC_ORDER: ProgressMetric[] = [
  'commissionRate',
  'omissionRate',
  'medianGoRtMs',
  'rtCv',
];

export type Verdict = 'better' | 'worse' | 'similar' | 'changed';

export interface Comparison {
  key: ProgressMetric;
  /** How the shown value moved. */
  direction: 'up' | 'down' | 'same';
  /** `changed`: it moved, but neither way is better (response time). */
  verdict: Verdict;
  /** Visible words: "More held back", "Faster", "Similar". */
  words: string;
  arrow: '↑' | '↓' | '≈';
  /** The reference, shown. */
  reference: number;
}

/** Compares one session value with a reference, both in the server's units. */
export function compareMetric(
  key: ProgressMetric,
  value: number | null,
  reference: number | null,
): Comparison | null {
  if (value === null || reference === null) return null;
  const m = METRICS[key];
  const shown = m.show(value);
  const ref = m.show(reference);
  if (Math.abs(value - reference) <= PROGRESS_CONFIG.similarWithin[key])
    return {
      key,
      direction: 'same',
      verdict: 'similar',
      words: 'Similar',
      arrow: '≈',
      reference: ref,
    };
  const direction = shown > ref ? 'up' : 'down';
  const verdict: Verdict =
    m.better === null
      ? 'changed'
      : (direction === 'up') === (m.better === 'higher')
        ? 'better'
        : 'worse';
  return {
    key,
    direction,
    verdict,
    words: m.moved[direction],
    arrow: direction === 'up' ? '↑' : '↓',
    reference: ref,
  };
}

export type ReferenceValues = Record<ProgressMetric, number | null>;

export type Reference =
  | { kind: 'none'; reason: 'first' | 'practiceOnly' }
  | { kind: 'baseline'; values: ReferenceValues }
  | { kind: 'earlier'; count: number; values: ReferenceValues };

const medianOrNull = (xs: (number | null)[]) => {
  const values = xs.filter((x): x is number => x !== null);
  return values.length ? median(values) : null;
};

/**
 * What a session is compared with (Spec 004, Results), by its place in the player's
 * history, so a session's comparison never changes later:
 * - the practice session: nothing;
 * - a session with only practice before it: nothing;
 * - a session in the baseline window (sessions 2–6): the median of the earlier non-practice
 *   sessions (their server scores);
 * - a later session: the server's baseline.
 */
export function chooseReference(
  sessionId: string,
  sessions: readonly CompletedSession[],
  summary: ProgressSummary,
): Reference {
  const { practiceSessions, baselineSessions, recentSessions } = PROGRESS_CONFIG;
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index < practiceSessions) return { kind: 'none', reason: 'first' };
  if (index >= practiceSessions + baselineSessions && summary.baseline) {
    const b = summary.baseline;
    return {
      kind: 'baseline',
      values: Object.fromEntries(METRIC_ORDER.map((k) => [k, b[k].median])) as ReferenceValues,
    };
  }
  const earlier = sessions.slice(practiceSessions, index).slice(-recentSessions);
  if (earlier.length === 0) return { kind: 'none', reason: 'practiceOnly' };
  return {
    kind: 'earlier',
    count: earlier.length,
    values: Object.fromEntries(
      METRIC_ORDER.map((k) => [k, medianOrNull(earlier.map((s) => s.score[k]))]),
    ) as ReferenceValues,
  };
}

/** "where you started", "your last check", "your last 3 checks". */
export function referenceName(reference: Reference): string {
  if (reference.kind === 'baseline') return 'where you started';
  if (reference.kind === 'earlier')
    return reference.count === 1 ? 'your last check' : `your last ${reference.count} checks`;
  return 'nothing';
}

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** The one-sentence conclusion at the top of Results. Describes, never diagnoses. */
export function headline(reference: Reference, comparisons: readonly Comparison[]): string {
  if (reference.kind === 'none')
    return reference.reason === 'first'
      ? 'Your first check is done. It counts as practice, so there is nothing to compare yet.'
      : 'Nothing to compare with yet: your first check was practice. From your next check on, Steady compares with your earlier ones.';
  const ref = referenceName(reference);
  if (comparisons.length === 0) return `Not enough presses to compare with ${ref}.`;
  const phrases = (v: Verdict) =>
    METRIC_ORDER.filter((k) => comparisons.some((c) => c.key === k && c.verdict === v)).map(
      (k) => METRICS[k].phrase,
    );
  const better = phrases('better');
  const worse = phrases('worse');
  if (better.length && worse.length)
    return `Better than ${ref} at ${list(better)}, below at ${list(worse)}.`;
  if (better.length) return `Better than ${ref} at ${list(better)}.`;
  if (worse.length) return `Below ${ref} at ${list(worse)}.`;
  const speed = comparisons.find((c) => c.verdict === 'changed');
  const tail = speed ? `, and ${speed.direction === 'down' ? 'faster' : 'slower'}` : '';
  return `Close to ${ref} on every measure${tail}.`;
}
