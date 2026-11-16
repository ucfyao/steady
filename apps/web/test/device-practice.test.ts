import { SART_CONFIG } from '@steady/core';
import { describe, expect, it } from 'vitest';
import { detectDevice } from '../src/game/device.js';
import { createPracticePlan } from '../src/game/practice.js';

describe('detectDevice', () => {
  const media = (coarse: boolean) => (q: string) => ({
    matches: coarse && q === '(pointer: coarse)',
  });

  it('uses touch when the primary pointer is coarse, otherwise the keyboard', () => {
    expect(detectDevice(media(true))).toBe('touch');
    expect(detectDevice(media(false))).toBe('keyboard');
  });

  it('falls back to the keyboard when matchMedia is unavailable', () => {
    expect(detectDevice(undefined)).toBe('keyboard');
  });
});

describe('createPracticePlan', () => {
  // From Spec 005: 12 trials, 10 go (every go digit at least once) and 2 3s, none in the
  // first 3, no probes.
  const seeds = Array.from({ length: 200 }, (_, i) => i * 31 + 7);

  it.each(seeds)('seed %i follows the practice rules', (seed) => {
    const { trials, probeAfter } = createPracticePlan(seed);
    expect(trials).toHaveLength(12);
    for (const d of [1, 2, 4, 5, 6, 7, 8, 9]) {
      expect(trials.some((t) => t.digit === d)).toBe(true);
    }
    expect(probeAfter).toEqual([]);
    expect(trials.filter((t) => t.digit === 3)).toHaveLength(2);
    expect(trials.slice(0, 3).some((t) => t.digit === 3)).toBe(false);
    trials.forEach((t, i) => {
      expect(t.index).toBe(i);
      expect(t.isTarget).toBe(t.digit === 3);
      expect(SART_CONFIG.digits).toContain(t.digit);
      expect(t.fontSize).toBeGreaterThanOrEqual(0);
      expect(t.fontSize).toBeLessThan(SART_CONFIG.fontSizes);
      if (i > 0) expect(t.digit).not.toBe(trials[i - 1]!.digit);
    });
  });

  it('starts slow and ends at the real speed, four trials per speed (Spec 005)', () => {
    const { trials, timing } = createPracticePlan(5);
    expect(timing).toHaveLength(trials.length);
    const at = (from: number, to: number) => timing.slice(from, to);
    expect(at(0, 4)).toEqual(Array(4).fill({ stimulusMs: 800, maskMs: 1200 }));
    expect(at(4, 8)).toEqual(Array(4).fill({ stimulusMs: 500, maskMs: 1000 }));
    expect(at(8, 12)).toEqual(Array(4).fill({ stimulusMs: 250, maskMs: 900 }));
  });

  it('is deterministic per seed and varies between seeds', () => {
    expect(createPracticePlan(1)).toEqual(createPracticePlan(1));
    expect(createPracticePlan(1)).not.toEqual(createPracticePlan(2));
  });
});
