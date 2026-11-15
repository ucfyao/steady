import { describe, expect, it } from 'vitest';
import { CheckInSchema, StartSessionSchema, SubmissionSchema } from '../src/index.js';

describe('SubmissionSchema (shared by API and web)', () => {
  it('parses a well-formed submission', () => {
    const parsed = SubmissionSchema.safeParse({
      rts: [400, null, 0, 1150],
      probeAnswers: ['on_task', 'drifting', 'elsewhere'],
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    ['RT above the trial window', { rts: [1151], probeAnswers: [] }],
    ['negative RT', { rts: [-1], probeAnswers: [] }],
    ['NaN RT', { rts: [Number.NaN], probeAnswers: [] }],
    ['string RT', { rts: ['400'], probeAnswers: [] }],
    ['unknown probe answer', { rts: [], probeAnswers: ['asleep'] }],
    ['missing field', { rts: [] }],
  ])('rejects %s', (_label, input) => {
    expect(SubmissionSchema.safeParse(input).success).toBe(false);
  });

  it('strips unknown fields such as a client-computed score', () => {
    const parsed = SubmissionSchema.parse({ rts: [], probeAnswers: [], score: 100 });
    expect(parsed).not.toHaveProperty('score');
  });
});

describe('CheckInSchema', () => {
  it('accepts full, partial and empty check-ins', () => {
    expect(CheckInSchema.parse({ sleep: 'good', stress: 'low' })).toEqual({
      sleep: 'good',
      stress: 'low',
    });
    expect(CheckInSchema.parse({ stress: 'high' })).toEqual({ stress: 'high' });
    expect(CheckInSchema.parse({})).toEqual({});
  });

  it('drops unknown fields', () => {
    expect(CheckInSchema.parse({ sleep: 'ok', mood: 'great' })).toEqual({ sleep: 'ok' });
  });

  it('rejects unknown levels', () => {
    expect(CheckInSchema.safeParse({ sleep: 'great' }).success).toBe(false);
    expect(CheckInSchema.safeParse({ stress: 3 }).success).toBe(false);
  });
});

describe('StartSessionSchema', () => {
  const device = 'keyboard';

  it('accepts a missing, null or partial check-in', () => {
    expect(StartSessionSchema.parse({ device })).toEqual({ device });
    expect(StartSessionSchema.parse({ checkIn: null, device })).toEqual({ checkIn: null, device });
    expect(StartSessionSchema.parse({ checkIn: { sleep: 'ok' }, device: 'touch' })).toEqual({
      checkIn: { sleep: 'ok' },
      device: 'touch',
    });
  });

  it('drops unknown fields', () => {
    expect(StartSessionSchema.parse({ checkIn: null, device, seed: 1 })).toEqual({
      checkIn: null,
      device,
    });
  });

  it('rejects an unknown check-in level', () => {
    expect(StartSessionSchema.safeParse({ checkIn: { stress: 'extreme' }, device }).success).toBe(
      false,
    );
  });

  it('requires a known input device', () => {
    expect(StartSessionSchema.safeParse({}).success).toBe(false);
    expect(StartSessionSchema.safeParse({ device: 'mouse' }).success).toBe(false);
  });
});
