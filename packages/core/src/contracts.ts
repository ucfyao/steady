/**
 * Wire contracts shared by the API (request validation) and the web app (typed client).
 * Plan-dependent rules (e.g. "one RT per planned trial") live in validateSubmission.
 */
import { z } from 'zod';
import { TRIAL_MS } from './config.js';
import { INPUT_DEVICES, PROBE_ANSWERS, SLEEP_LEVELS, STRESS_LEVELS, VARIANTS } from './types.js';

export const ProbeAnswerSchema = z.enum(PROBE_ANSWERS);

/** ms from stimulus onset to first key press, or null for no press. */
export const RtSchema = z.number().finite().min(0).max(TRIAL_MS).nullable();

export const SubmissionSchema = z.object({
  rts: z.array(RtSchema),
  probeAnswers: z.array(ProbeAnswerSchema),
});

/** Optional self-report before a session; unknown fields are dropped. */
export const CheckInSchema = z.object({
  sleep: z.enum(SLEEP_LEVELS).optional(),
  stress: z.enum(STRESS_LEVELS).optional(),
});

/** A player's name (Spec 013): trimmed, 1 to 30 characters, not necessarily unique. */
export const PlayerNameSchema = z.string().trim().min(1).max(30);

/**
 * POST /api/players (Spec 013). A variant is chosen only by the development tools (Spec 011
 * §3); without it the server draws one. Strict, so a typo is a 400 rather than ignored.
 */
export const CreatePlayerSchema = z
  .object({
    name: PlayerNameSchema,
    variant: z.enum(VARIANTS).optional(),
  })
  .strict();

/** PATCH /api/me (Spec 013): only the name can change; the group never does. */
export const UpdateMeSchema = z.object({ name: PlayerNameSchema }).strict();

/** POST /api/sessions */
export const StartSessionSchema = z.object({
  checkIn: CheckInSchema.nullish(),
  device: z.enum(INPUT_DEVICES),
  /** A play-test override (`?variant=`); without it, the player's own variant applies. */
  variant: z.enum(VARIANTS).optional(),
});
