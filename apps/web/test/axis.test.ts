import { describe, expect, it } from 'vitest';
import { yAxis } from '../src/progress/axis.js';
import { metricView } from '../src/progress/metrics.js';

const missed = metricView('omissionRate');
const response = metricView('medianGoRtMs');
const fmt = missed.format;

describe('yAxis (Progress charts)', () => {
  it('uses one decimal when whole percents would repeat (missed digits 2–4%)', () => {
    // The reported bug: recharts ticks at 2, 2.5, 3, 3.5, 4% were shown as 2%, 3%, 3%, 4%, 4%.
    const axis = yAxis([0.021, 0.03, 0.038], fmt)!;
    expect(axis.ticks.map((t) => +(t * 100).toFixed(6))).toEqual([2, 2.5, 3, 3.5, 4]);
    expect(axis.labels).toEqual(['2.0%', '2.5%', '3.0%', '3.5%', '4.0%']);
  });

  it('keeps whole percents when the range is wide', () => {
    const axis = yAxis([0.62, 0.9], fmt)!;
    expect(axis.labels).toEqual(['60%', '70%', '80%', '90%']);
  });

  it('never repeats a label, for any narrow range', () => {
    for (let lo = 0; lo < 0.2; lo += 0.0037) {
      for (const width of [0, 0.0004, 0.002, 0.009, 0.03]) {
        const { ticks, labels } = yAxis([lo, lo + width], fmt)!;
        expect(new Set(labels).size).toBe(labels.length);
        // Each label is its tick exactly, not a rounded neighbour (2.5% never reads "3%").
        labels.forEach((l, i) => expect(parseFloat(l)).toBeCloseTo(ticks[i]! * 100, 9));
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        expect(ticks.length).toBeLessThanOrEqual(6);
        expect(ticks[0]).toBeLessThanOrEqual(lo + 1e-9);
        expect(ticks.at(-1)).toBeGreaterThanOrEqual(lo + width - 1e-9);
      }
    }
  });

  it('works for milliseconds and a single value', () => {
    expect(yAxis([395, 412, 431], response.format)!.labels).toEqual([
      '390 ms',
      '400 ms',
      '410 ms',
      '420 ms',
      '430 ms',
      '440 ms',
    ]);
    const one = yAxis([0.05], fmt)!;
    expect(new Set(one.labels).size).toBe(one.labels.length);
    expect(one.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it('has no axis without values', () => {
    expect(yAxis([], fmt)).toBeNull();
  });
});
