import { PROGRESS_CONFIG, type MetricSet, type ProgressSummary } from '@steady/core';
import { describe, expect, it } from 'vitest';
import {
  METRICS,
  METRIC_ORDER,
  chooseReference,
  compareMetric,
  directionText,
  headline,
  progressHeadline,
  referenceName,
  type Comparison,
  type Reference,
} from '../src/metrics/metrics.js';
import { storedSession } from './support/sessions.js';

const W = PROGRESS_CONFIG.similarWithin;

describe('metric definitions', () => {
  it('says which way is better for each metric (Spec 002 and the design note)', () => {
    expect(METRICS.commissionRate.better).toBe('higher'); // shown as catch rate
    expect(METRICS.omissionRate.better).toBe('lower');
    expect(METRICS.rtCv.better).toBe('lower');
    // Speed trades off against errors, so neither way is called better.
    expect(METRICS.medianGoRtMs.better).toBeNull();
  });

  it('has a plain name, a sentence and the research term for every metric', () => {
    expect(METRIC_ORDER).toEqual(['commissionRate', 'omissionRate', 'medianGoRtMs', 'rtCv']);
    for (const key of METRIC_ORDER) {
      const m = METRICS[key];
      expect(m.key).toBe(key);
      expect(m.name).not.toBe(m.term);
      expect(m.description).toMatch(/\.$/);
      expect(m.term.length).toBeGreaterThan(0);
    }
    expect(METRICS.rtCv.term).toMatch(/Rhythm variability/);
  });

  it('shows commission rate as catch rate', () => {
    expect(METRICS.commissionRate.show(0.25)).toBe(0.75);
    expect(METRICS.commissionRate.format(0.75)).toBe('75%');
    expect(METRICS.medianGoRtMs.format(401.6)).toBe('402 ms');
  });
});

describe('compareMetric', () => {
  it('calls a higher catch rate better, and a lower one worse', () => {
    // Commission 0.1 vs 0.3: catch rate 90% vs 70%.
    expect(compareMetric('commissionRate', 0.1, 0.3)).toEqual<Comparison>({
      key: 'commissionRate',
      direction: 'up',
      verdict: 'better',
      words: 'More held back',
      arrow: '↑',
      reference: 0.7,
    });
    expect(compareMetric('commissionRate', 0.45, 0.2)).toMatchObject({
      direction: 'down',
      verdict: 'worse',
      words: 'Fewer held back',
      arrow: '↓',
    });
  });

  it('calls fewer missed digits and more even timing better', () => {
    expect(compareMetric('omissionRate', 0.01, 0.06)).toMatchObject({
      direction: 'down',
      verdict: 'better',
      words: 'Fewer missed',
    });
    expect(compareMetric('omissionRate', 0.06, 0.01)).toMatchObject({
      direction: 'up',
      verdict: 'worse',
      words: 'More missed',
    });
    expect(compareMetric('rtCv', 0.1, 0.2)).toMatchObject({
      direction: 'down',
      verdict: 'better',
      words: 'More even',
    });
    expect(compareMetric('rtCv', 0.3, 0.2)).toMatchObject({ verdict: 'worse', words: 'Less even' });
  });

  it('describes response time as faster or slower, never better or worse', () => {
    expect(compareMetric('medianGoRtMs', 350, 400)).toMatchObject({
      direction: 'down',
      verdict: 'changed',
      words: 'Faster',
      arrow: '↓',
    });
    expect(compareMetric('medianGoRtMs', 450, 400)).toMatchObject({
      verdict: 'changed',
      words: 'Slower',
    });
  });

  it("calls a change within the config's band similar, and one just outside it a change", () => {
    for (const key of METRIC_ORDER) {
      const ref = key === 'medianGoRtMs' ? 400 : 0.2;
      expect(compareMetric(key, ref + W[key] * 0.9, ref)).toMatchObject({
        direction: 'same',
        verdict: 'similar',
        words: 'Similar',
        arrow: '≈',
      });
      expect(compareMetric(key, ref - W[key] * 0.9, ref)?.verdict).toBe('similar');
      expect(compareMetric(key, ref + W[key] * 1.1, ref)?.verdict).not.toBe('similar');
      expect(compareMetric(key, ref - W[key] * 1.1, ref)?.verdict).not.toBe('similar');
    }
  });

  it('compares nothing when either value is missing', () => {
    expect(compareMetric('medianGoRtMs', null, 400)).toBeNull();
    expect(compareMetric('rtCv', 0.2, null)).toBeNull();
  });
});

const set = (v: Partial<Record<keyof MetricSet, number | null>>): MetricSet => ({
  commissionRate: { median: v.commissionRate ?? null, n: 5 },
  omissionRate: { median: v.omissionRate ?? null, n: 5 },
  medianGoRtMs: { median: v.medianGoRtMs ?? null, n: 5 },
  rtCv: { median: v.rtCv ?? null, n: 5 },
});

const noBaseline: ProgressSummary = {
  totalSessions: 0,
  practiceSessions: 0,
  sessionsUntilBaseline: 6,
  baseline: null,
  recent: null,
};

describe('chooseReference', () => {
  // Sessions 1–8, oldest first, as the API lists them. Session n has commission rate n / 100.
  const sessions = Array.from({ length: 8 }, (_, i) =>
    storedSession(i + 1, {
      commissionRate: (i + 1) / 100,
      omissionRate: 0.05,
      medianGoRtMs: i === 1 ? null : 400 + i,
      rtCv: 0.2,
    }),
  );
  const summary: ProgressSummary = {
    ...noBaseline,
    totalSessions: 8,
    practiceSessions: 1,
    sessionsUntilBaseline: 0,
    // Deliberately unlike the sessions above: the baseline must come from the server.
    baseline: set({ commissionRate: 0.5, omissionRate: 0.1, medianGoRtMs: 333, rtCv: 0.3 }),
    recent: set({ commissionRate: 0.6 }),
  };

  it('compares the first session with nothing: it is practice', () => {
    expect(chooseReference('s1', sessions, summary)).toEqual({ kind: 'none', reason: 'first' });
  });

  it('compares session 2 with nothing, because only practice came before it', () => {
    expect(chooseReference('s2', sessions, summary)).toEqual({
      kind: 'none',
      reason: 'practiceOnly',
    });
  });

  it('compares sessions 3–6 with the median of the earlier non-practice sessions', () => {
    // Session 4: sessions 2 and 3. Commission (0.02 + 0.03) / 2; response time only from 3.
    expect(chooseReference('s4', sessions, noBaseline)).toEqual({
      kind: 'earlier',
      count: 2,
      values: { commissionRate: 0.025, omissionRate: 0.05, medianGoRtMs: 402, rtCv: 0.2 },
    });
    // Session 6 keeps that comparison even after the baseline exists.
    expect(chooseReference('s6', sessions, summary)).toMatchObject({
      kind: 'earlier',
      count: 4,
      values: { commissionRate: 0.035 },
    });
  });

  it("compares a session after the baseline with the server's baseline", () => {
    expect(chooseReference('s7', sessions, summary)).toEqual({
      kind: 'baseline',
      values: { commissionRate: 0.5, omissionRate: 0.1, medianGoRtMs: 333, rtCv: 0.3 },
    });
  });

  it('uses at most the last 5 earlier sessions if the baseline is missing', () => {
    // Session 8 without a baseline: sessions 3–7, median commission 0.05.
    expect(chooseReference('s8', sessions, noBaseline)).toMatchObject({
      kind: 'earlier',
      count: 5,
      values: { commissionRate: 0.05 },
    });
  });
});

describe('headline', () => {
  const baseline: Reference = {
    kind: 'baseline',
    values: { commissionRate: 0.3, omissionRate: 0.05, medianGoRtMs: 400, rtCv: 0.2 },
  };
  const earlier = (count: number): Reference => ({ ...baseline, kind: 'earlier', count });
  const cmp = (key: keyof typeof METRICS, verdict: Comparison['verdict']): Comparison => ({
    key,
    verdict,
    direction: verdict === 'similar' ? 'same' : 'up',
    words: '',
    arrow: '↑',
    reference: 0,
  });
  const allSimilar = METRIC_ORDER.map((k) => cmp(k, 'similar'));

  it('names the reference', () => {
    expect(referenceName(baseline)).toBe('where you started');
    expect(referenceName(earlier(1))).toBe('your last check');
    expect(referenceName(earlier(3))).toBe('your last 3 checks');
  });

  it('is neutral when there is nothing to compare with', () => {
    expect(headline({ kind: 'none', reason: 'first' }, [])).toBe(
      'Your first check is done. It counts as practice, so there is nothing to compare yet.',
    );
    expect(headline({ kind: 'none', reason: 'practiceOnly' }, [])).toBe(
      'Nothing to compare with yet: your first check was practice. From your next check on, Steady compares with your earlier ones.',
    );
  });

  it('says when every measure is close to the reference', () => {
    expect(headline(baseline, allSimilar)).toBe('Close to where you started on every measure.');
  });

  it('adds faster or slower when only response time moved', () => {
    const faster = { ...cmp('medianGoRtMs', 'changed'), direction: 'down' as const };
    const cs = allSimilar.map((c) => (c.key === 'medianGoRtMs' ? faster : c));
    expect(headline(earlier(2), cs)).toBe(
      'Close to your last 2 checks on every measure, and faster.',
    );
  });

  it('names what was better, what was below, or both', () => {
    expect(
      headline(baseline, [
        cmp('commissionRate', 'better'),
        cmp('omissionRate', 'similar'),
        cmp('medianGoRtMs', 'changed'),
        cmp('rtCv', 'better'),
      ]),
    ).toBe('Better than where you started at holding back on 3s and keeping an even rhythm.');
    expect(
      headline(earlier(1), [cmp('omissionRate', 'worse'), cmp('commissionRate', 'similar')]),
    ).toBe('Below your last check at catching every digit.');
    expect(
      headline(baseline, [
        cmp('commissionRate', 'better'),
        cmp('omissionRate', 'worse'),
        cmp('rtCv', 'worse'),
      ]),
    ).toBe(
      'Better than where you started at holding back on 3s, below at catching every digit and keeping an even rhythm.',
    );
  });

  it('says so when no measure could be compared', () => {
    expect(headline(baseline, [])).toBe('Not enough presses to compare with where you started.');
  });

  it('only describes: no words that judge the player', () => {
    const verdicts: Comparison['verdict'][] = ['better', 'worse', 'similar', 'changed'];
    const texts = verdicts.flatMap((v) =>
      verdicts.map((u) => headline(baseline, [cmp('commissionRate', v), cmp('rtCv', u)])),
    );
    for (const t of texts) expect(t).not.toMatch(/focus|attention|tired|distract|fail|bad|poor/i);
  });
});

describe('directionText', () => {
  it('says which way is better, and that neither is for response time', () => {
    expect(directionText('commissionRate')).toBe('Higher is better');
    expect(directionText('omissionRate')).toBe('Lower is better');
    expect(directionText('rtCv')).toBe('Lower is better');
    expect(directionText('medianGoRtMs')).toBe('Neither way is better');
  });
});

describe('progressHeadline', () => {
  const set = (c: number, o: number, rt: number | null, cv: number | null): MetricSet => ({
    commissionRate: { median: c, n: 5 },
    omissionRate: { median: o, n: 5 },
    medianGoRtMs: { median: rt, n: 5 },
    rtCv: { median: cv, n: 5 },
  });
  const summary = (
    baseline: MetricSet | null,
    recent: MetricSet | null,
    until = 0,
  ): ProgressSummary => ({
    totalSessions: 6 - until,
    practiceSessions: 1,
    sessionsUntilBaseline: until,
    baseline,
    recent,
  });

  it('counts down before the baseline exists', () => {
    expect(progressHeadline(summary(null, null, 3))).toBe(
      '3 more sessions until your starting point. Until then, the charts show each check.',
    );
    expect(progressHeadline(summary(null, null, 1))).toBe(
      '1 more session until your starting point. Until then, the charts show each check.',
    );
  });

  it('compares the recent medians with the baseline, in the Results wording', () => {
    // Catch rate 80% → 95% (beyond the 0.1 band): better. Missed 5% → 5%: similar.
    // Response 400 → 370 ms: faster, which is neither. Variation 20% → 25% (beyond 0.02): below.
    expect(progressHeadline(summary(set(0.2, 0.05, 400, 0.2), set(0.05, 0.05, 370, 0.25)))).toBe(
      'Your last 5 checks: better than where you started at holding back on 3s, below at keeping an even rhythm.',
    );
    // Everything inside the bands; response 400 → 430 ms is slower.
    expect(progressHeadline(summary(set(0.2, 0.05, 400, 0.2), set(0.15, 0.06, 430, 0.21)))).toBe(
      'Your last 5 checks: close to where you started on every measure, and slower.',
    );
  });

  it('only describes: no words that judge the player', () => {
    const t = progressHeadline(summary(set(0.2, 0.05, 400, 0.2), set(0.5, 0.2, 300, 0.4)));
    expect(t).toBe(
      'Your last 5 checks: below where you started at holding back on 3s, catching every digit and keeping an even rhythm.',
    );
    expect(t).not.toMatch(/focus|attention|tired|distract|fail|bad|poor/i);
  });
});
