import { SubmissionSchema } from './contracts.js';
import type { SessionPlan, ValidationResult } from './types.js';

/**
 * Technical validity only: the shape check comes from the shared SubmissionSchema,
 * then the plan-dependent counts. Behavioural oddities (many omissions, fast presses)
 * are not errors; they become descriptive flags in scoring.
 * Accepts `unknown` so it can sit directly behind an HTTP boundary.
 */
export function validateSubmission(plan: SessionPlan, input: unknown): ValidationResult {
  const parsed = SubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const [field, index] = issue.path;
        if (field === 'rts' && typeof index === 'number') return `trial ${index}: ${issue.message}`;
        if (field === 'probeAnswers' && typeof index === 'number')
          return `probe ${index}: ${issue.message}`;
        return `${issue.path.join('.') || 'submission'}: ${issue.message}`;
      }),
    };
  }

  const { rts, probeAnswers } = parsed.data;
  const errors: string[] = [];
  if (rts.length !== plan.trials.length) {
    errors.push(`expected ${plan.trials.length} trial responses, got ${rts.length}`);
  }
  if (probeAnswers.length !== plan.probeAfter.length) {
    errors.push(`expected ${plan.probeAfter.length} probe answers, got ${probeAnswers.length}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
