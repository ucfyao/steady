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
    // Spec 005: 81 trials, 9 of each digit (from the spec, not the config)
    expect(trials).toHaveLength(81);

    const counts = new Map<number, number>();
    trials.forEach((t, i) => {
      counts.set(t.digit, (counts.get(t.digit) ?? 0) + 1);
      expect(t.index).toBe(i);
      expect(t.isTarget).toBe(t.digit === SART_CONFIG.targetDigit);
      expect(t.fontSize).toBeGreaterThanOrEqual(0);
      expect(t.fontSize).toBeLessThan(SART_CONFIG.fontSizes);
      if (i > 0) expect(t.digit).not.toBe(trials[i - 1]!.digit);
    });
    for (const d of SART_CONFIG.digits) expect(counts.get(d)).toBe(9);
  });

  it.each(SEEDS)('seed %i: no target during the first 5 (warm-up) trials', (seed) => {
    // 5 is from the spec, not read from config, so changing config alone can't hide a regression
    const firstFive = createSessionPlan(seed).trials.slice(0, 5);
    expect(firstFive.some((t) => t.digit === 3)).toBe(false);
  });

  it.each(SEEDS)('seed %i: probes on go trials with bounded gaps', (seed) => {
    const { trials, probeAfter } = createSessionPlan(seed);
    // Spec 005: 3 probes, the first at 19–25, gaps 20–26, the last at or before 75
    expect(probeAfter).toHaveLength(3);

    let prev = -1;
    for (const p of probeAfter) {
      expect(trials[p]!.isTarget).toBe(false);
      const gap = p - prev;
      // nominal gap 20–26; shifting off a target can move a probe back by one
      expect(gap).toBeGreaterThanOrEqual(19);
      expect(gap).toBeLessThanOrEqual(27);
      prev = p;
    }
    expect(prev).toBeLessThanOrEqual(75);
  });
});
