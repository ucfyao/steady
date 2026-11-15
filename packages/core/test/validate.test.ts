import { describe, expect, it } from 'vitest';
import { createSessionPlan, validateSubmission } from '../src/index.js';
import { perfect, submit } from './helpers.js';

const plan = createSessionPlan(7);

describe('validateSubmission', () => {
  it('accepts a well-formed submission', () => {
    expect(validateSubmission(plan, submit(plan, perfect()))).toEqual({ ok: true });
  });

  it('rejects the wrong number of trials', () => {
    const s = submit(plan, perfect());
    s.rts.pop();
    expect(validateSubmission(plan, s).ok).toBe(false);
  });

  it.each([-1, 1151, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an out-of-range RT (%s)',
    (bad) => {
      const s = submit(plan, perfect());
      s.rts[10] = bad;
      const result = validateSubmission(plan, s);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join(' ')).toMatch(/trial 10/);
    },
  );

  it('accepts boundary RTs 0 and 1150', () => {
    const s = submit(plan, perfect());
    s.rts[10] = 0;
    s.rts[11] = 1150;
    expect(validateSubmission(plan, s).ok).toBe(true);
  });

  it('rejects the wrong number of probe answers', () => {
    const s = submit(plan, perfect());
    s.probeAnswers.pop();
    expect(validateSubmission(plan, s).ok).toBe(false);
  });

  it('rejects an unknown probe answer', () => {
    const s = submit(plan, perfect());
    (s.probeAnswers as string[])[0] = 'asleep';
    expect(validateSubmission(plan, s).ok).toBe(false);
  });
});
