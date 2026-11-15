import { describe, expect, it } from 'vitest';
import { weeklyTarget } from '../src/progress/weekly.js';

// Local times, built with the local Date constructor, so the test holds in any time zone.
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const NOW = new Date(2026, 10, 16, 14, 0); // Monday 16 Nov 2026, 14:00 local

describe('weeklyTarget (Spec 004: 4 of the last 7 local days)', () => {
  it('has no days with no sessions', () => {
    expect(weeklyTarget([], NOW)).toEqual({
      days: [false, false, false, false, false, false, false],
      count: 0,
      target: 4,
    });
  });

  it('counts two sessions on one day once', () => {
    const r = weeklyTarget([at(16, 9), at(16, 13)], NOW);
    expect(r.count).toBe(1);
    expect(r.days).toEqual([false, false, false, false, false, false, true]);
  });

  it('covers today and the six days before it, by local calendar day', () => {
    const r = weeklyTarget(
      [
        at(9, 23, 59), // 7 days ago: outside
        at(10, 0, 1), // 6 days ago: inside, first dot
        at(12, 12),
        at(15, 23, 59),
        at(16, 0, 0),
      ],
      NOW,
    );
    expect(r.days).toEqual([true, false, true, false, false, true, true]);
    expect(r.count).toBe(4);
  });

  it('ignores sessions after now (another device clock)', () => {
    expect(weeklyTarget([at(17, 9)], NOW).count).toBe(0);
  });
});
