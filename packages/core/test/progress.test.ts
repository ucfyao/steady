import { describe, expect, it } from 'vitest';
import {
  compareByCheckIn,
  comparePreProbe,
  summariseProgress,
  type CheckIn,
  type ProbeResult,
  type ProgressSession,
} from '../src/index.js';

type Metrics = Partial<Omit<ProgressSession['score'], 'probes'>>;

const session = (
  m: Metrics = {},
  checkIn: CheckIn | null = null,
  probes: ProbeResult[] = [],
): ProgressSession => ({
  score: { commissionRate: 0, omissionRate: 0, medianGoRtMs: 400, rtCv: 0.2, probes, ...m },
  checkIn,
});

// Session 1 is practice; its extreme values must never leak into a summary.
const PRACTICE = session({ commissionRate: 9, omissionRate: 9, medianGoRtMs: 9999, rtCv: 9 });

// Sessions 2–6. Hand-computed medians: 0.3, 0.02, 400, 0.2.
const BASELINE_SESSIONS = [
  session({ commissionRate: 0.1, omissionRate: 0, medianGoRtMs: 400, rtCv: 0.2 }),
  session({ commissionRate: 0.5, omissionRate: 0.02, medianGoRtMs: 420, rtCv: 0.1 }),
  session({ commissionRate: 0.2, omissionRate: 0.01, medianGoRtMs: 380, rtCv: 0.3 }),
  session({ commissionRate: 0.4, omissionRate: 0.04, medianGoRtMs: 410, rtCv: 0.15 }),
  session({ commissionRate: 0.3, omissionRate: 0.03, medianGoRtMs: 390, rtCv: 0.25 }),
];
const BASELINE = {
  commissionRate: { median: 0.3, n: 5 },
  omissionRate: { median: 0.02, n: 5 },
  medianGoRtMs: { median: 400, n: 5 },
  rtCv: { median: 0.2, n: 5 },
};

describe('summariseProgress', () => {
  it('has nothing to show with no sessions', () => {
    expect(summariseProgress([])).toEqual({
      totalSessions: 0,
      practiceSessions: 0,
      sessionsUntilBaseline: 6,
      baseline: null,
      recent: null,
    });
  });

  it('has no baseline before session 6', () => {
    const p = summariseProgress([PRACTICE, ...BASELINE_SESSIONS.slice(0, 4)]);
    expect(p.totalSessions).toBe(5);
    expect(p.practiceSessions).toBe(1);
    expect(p.sessionsUntilBaseline).toBe(1);
    expect(p.baseline).toBeNull();
    expect(p.recent).toBeNull();
  });

  it('sets the baseline from sessions 2–6, ignoring the practice session', () => {
    const p = summariseProgress([PRACTICE, ...BASELINE_SESSIONS]);
    expect(p.sessionsUntilBaseline).toBe(0);
    expect(p.baseline).toEqual(BASELINE);
    expect(p.recent).toEqual(BASELINE);
  });

  it('keeps the baseline fixed and moves recent to the last 5 sessions', () => {
    const later = [0.05, 0.6, 0.7, 0.8, 0.9, 1.0].map((c) => session({ commissionRate: c }));
    const p = summariseProgress([PRACTICE, ...BASELINE_SESSIONS, ...later]);
    expect(p.totalSessions).toBe(12);
    expect(p.baseline).toEqual(BASELINE);
    // Sessions 8–12 only; session 7 (0.05) has dropped out of the window.
    expect(p.recent?.commissionRate).toEqual({ median: 0.8, n: 5 });
  });

  it('skips null metric values and reports how many were used', () => {
    const withNulls = BASELINE_SESSIONS.map((s, i) =>
      session({ ...s.score, medianGoRtMs: i % 2 === 0 ? s.score.medianGoRtMs : null, rtCv: null }),
    );
    const p = summariseProgress([PRACTICE, ...withNulls]);
    // Non-null RTs: 400, 380, 390 → 390
    expect(p.baseline?.medianGoRtMs).toEqual({ median: 390, n: 3 });
    expect(p.baseline?.rtCv).toEqual({ median: null, n: 0 });
  });
});

const sleepy = (c: number, n: number, sleep: CheckIn['sleep']) =>
  Array.from({ length: n }, (_, i) => session({ commissionRate: c + i / 100 }, { sleep }));

describe('compareByCheckIn', () => {
  // Practice says "poor"; it must not be counted.
  const practice = session({ commissionRate: 9 }, { sleep: 'poor', stress: 'high' });
  const good = sleepy(0.1, 10, 'good'); // 0.10 … 0.19 → median 0.145
  const poor9 = sleepy(0.3, 9, 'poor'); // 0.30 … 0.38
  const noAnswer = [session({ commissionRate: 5 }), session({ commissionRate: 5 }, {})];
  const stressOnly = session({ commissionRate: 5 }, { stress: 'low' });

  it('returns every level in a fixed order, with n and the raw values', () => {
    const c = compareByCheckIn(
      [practice, ...good, ...noAnswer, stressOnly, ...poor9],
      'sleep',
      'commissionRate',
    );
    expect(c.groups.map((g) => g.key)).toEqual(['poor', 'ok', 'good']);
    const [poor, ok, goodGroup] = c.groups;
    expect(poor).toMatchObject({ n: 9, median: null });
    expect(poor?.values[0]).toBeCloseTo(0.3);
    expect(ok).toEqual({ key: 'ok', n: 0, values: [], median: null });
    expect(goodGroup?.n).toBe(10);
    expect(goodGroup?.median).toBeCloseTo(0.145);
    expect(c.canSummarise).toBe(false);
  });

  it('allows a summary only when two groups have at least 10 sessions', () => {
    const poor10 = sleepy(0.3, 10, 'poor'); // 0.30 … 0.39 → median 0.345
    const c = compareByCheckIn([practice, ...good, ...poor10], 'sleep', 'commissionRate');
    expect(c.groups[0]?.median).toBeCloseTo(0.345);
    expect(c.canSummarise).toBe(true);
  });

  it('splits by stress and skips null metric values', () => {
    const stressed = Array.from({ length: 3 }, (_, i) =>
      session({ medianGoRtMs: i === 1 ? null : 500 }, { stress: 'high' }),
    );
    const c = compareByCheckIn([practice, ...stressed], 'stress', 'medianGoRtMs');
    expect(c.groups.map((g) => g.key)).toEqual(['low', 'medium', 'high']);
    expect(c.groups[2]).toEqual({ key: 'high', n: 2, values: [500, 500], median: null });
  });
});

const probe = (answer: ProbeResult['answer'], preProbeCv: number | null): ProbeResult => ({
  afterIndex: 30,
  answer,
  preProbeCv,
});

describe('comparePreProbe', () => {
  it('pools probes across non-practice sessions by answer', () => {
    const practice = session({}, null, [probe('on_task', 9), probe('elsewhere', 9)]);
    const s2 = session({}, null, [
      probe('on_task', 0.1),
      probe('drifting', 0.3),
      probe('on_task', null),
    ]);
    const s3 = session({}, null, [probe('on_task', 0.2), probe('drifting', null)]);
    const c = comparePreProbe([practice, s2, s3]);
    expect(c.groups).toEqual([
      { key: 'on_task', n: 2, values: [0.1, 0.2], median: null },
      { key: 'drifting', n: 1, values: [0.3], median: null },
      { key: 'elsewhere', n: 0, values: [], median: null },
    ]);
    expect(c.canSummarise).toBe(false);
  });

  it('reports medians and allows a summary at 10 per group', () => {
    const probes = [
      ...Array.from({ length: 10 }, (_, i) => probe('on_task', 0.1 + i / 100)), // median 0.145
      ...Array.from({ length: 10 }, (_, i) => probe('elsewhere', 0.2 + i / 100)), // median 0.245
    ];
    const c = comparePreProbe([session(), session({}, null, probes)]);
    expect(c.groups[0]?.median).toBeCloseTo(0.145);
    expect(c.groups[2]?.median).toBeCloseTo(0.245);
    expect(c.canSummarise).toBe(true);
  });
});
