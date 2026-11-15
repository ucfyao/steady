import { describe, expect, it } from 'vitest';
import { coefficientOfVariation, median, probit, sampleSd } from '../src/index.js';

const X = [300, 400, 500, 350, 450, 420, 380, 360, 440, 400];

describe('stats', () => {
  it('median handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median(X)).toBe(400);
  });

  it('sample SD and CV match reference values', () => {
    // Reference: Python statistics.stdev
    expect(sampleSd(X)).toBeCloseTo(56.76462121975467, 9);
    expect(coefficientOfVariation(X)).toBeCloseTo(0.14191155304938669, 9);
  });

  it('probit matches the inverse normal CDF', () => {
    expect(probit(0.5)).toBeCloseTo(0, 9);
    expect(probit(0.975)).toBeCloseTo(1.9599639845400534, 6);
    expect(probit(0.025)).toBeCloseTo(-1.9599639845400534, 6);
    expect(probit(0.001)).toBeCloseTo(-3.090232306167813, 6);
    expect(probit(0.999)).toBeCloseTo(3.090232306167813, 6);
    expect(probit(0.02425)).toBeCloseTo(-1.9729610513118845, 6); // region boundary
    expect(probit(0.3)).toBeCloseTo(-0.5244005127080408, 6);
  });

  it('probit rejects values outside (0, 1)', () => {
    expect(() => probit(0)).toThrow(RangeError);
    expect(() => probit(1)).toThrow(RangeError);
  });
});
