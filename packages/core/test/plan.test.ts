import { describe, expect, it } from 'vitest';
import { SART_CONFIG, createSessionPlan } from '../src/index.js';

const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 + 1);

describe('createSessionPlan', () => {
  it('is deterministic for a given seed', () => {
    expect(createSessionPlan(42)).toEqual(createSessionPlan(42));
  });

  it('produces different plans for different seeds', () => {
    const a = createSessionPlan(1).trials.map((t) => t.digit);
    const b = createSessionPlan(2).trials.map((t) => t.digit);
    expect(a).not.toEqual(b);
  });

  it.each(SEEDS)('seed %i: balanced digits, no adjacent repeats, valid font sizes', (seed) => {
    const { trials } = createSessionPlan(seed);
    expect(trials).toHaveLength(SART_CONFIG.digits.length * SART_CONFIG.copiesPerDigit);

    const counts = new Map<number, number>();
    trials.forEach((t, i) => {
      counts.set(t.digit, (counts.get(t.digit) ?? 0) + 1);
      expect(t.index).toBe(i);
      expect(t.isTarget).toBe(t.digit === SART_CONFIG.targetDigit);
      expect(t.fontSize).toBeGreaterThanOrEqual(0);
      expect(t.fontSize).toBeLessThan(SART_CONFIG.fontSizes);
      if (i > 0) expect(t.digit).not.toBe(trials[i - 1]!.digit);
    });
    for (const d of SART_CONFIG.digits) expect(counts.get(d)).toBe(SART_CONFIG.copiesPerDigit);
  });

  it.each(SEEDS)('seed %i: no target during the first 5 (warm-up) trials', (seed) => {
    // 5 is from the spec, not read from config, so changing config alone can't hide a regression
    const firstFive = createSessionPlan(seed).trials.slice(0, 5);
    expect(firstFive.some((t) => t.digit === 3)).toBe(false);
  });

  it.each(SEEDS)('seed %i: probes on go trials with bounded gaps', (seed) => {
    const { trials, probeAfter } = createSessionPlan(seed);
    expect(probeAfter).toHaveLength(SART_CONFIG.probesPerSession);

    let prev = -1;
    for (const p of probeAfter) {
      expect(trials[p]!.isTarget).toBe(false);
      const gap = p - prev;
      // nominal gap 25–35; shifting off a target can move a probe back by one
      expect(gap).toBeGreaterThanOrEqual(SART_CONFIG.probeGapMin - 1);
      expect(gap).toBeLessThanOrEqual(SART_CONFIG.probeGapMax + 1);
      prev = p;
    }
    expect(prev).toBeLessThanOrEqual(SART_CONFIG.lastProbeMaxIndex);
  });
});
