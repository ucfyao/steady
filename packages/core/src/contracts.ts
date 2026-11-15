/**
 * Wire contracts shared by the API (request validation) and the web app (typed client).
 * Plan-dependent rules (e.g. "one RT per planned trial") live in validateSubmission.
 */
import { z } from 'zod';
import { TRIAL_MS } from './config.js';
import { PROBE_ANSWERS } from './types.js';

export const ProbeAnswerSchema = z.enum(PROBE_ANSWERS);

/** ms from stimulus onset to first key press, or null for no press. */
export const RtSchema = z.number().finite().min(0).max(TRIAL_MS).nullable();

export const SubmissionSchema = z.object({
  rts: z.array(RtSchema),
  probeAnswers: z.array(ProbeAnswerSchema),
});
