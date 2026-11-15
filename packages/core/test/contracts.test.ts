import { describe, expect, it } from 'vitest';
import { SubmissionSchema } from '../src/index.js';

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
