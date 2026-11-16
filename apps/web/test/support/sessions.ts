import type { CheckIn, CompletedSession, ProbeResult, SessionScore, Variant } from '@steady/core';

/** A stored session with a hand-picked score, for progress tests (the server's output). */
export function storedSession(
  n: number,
  score: Partial<SessionScore> = {},
  opts: {
    checkIn?: CheckIn | null;
    completedAt?: Date;
    probes?: ProbeResult[];
    variant?: Variant;
  } = {},
): CompletedSession {
  const completedAt = opts.completedAt ?? new Date();
  return {
    id: `s${n}`,
    startedAt: new Date(completedAt.getTime() - 180_000).toISOString(),
    completedAt: completedAt.toISOString(),
    checkIn: opts.checkIn ?? null,
    device: 'keyboard',
    variant: opts.variant ?? 'calm',
    score: {
      scoringVersion: 3,
      commissions: 0,
      commissionRate: 0.2,
      // 6 of the 72 digits (Spec 005), so the count and the rate agree.
      omissions: 6,
      omissionRate: 6 / 72,
      anticipations: 0,
      medianGoRtMs: 400,
      rtCv: 0.2,
      dPrime: 3,
      longestSteadyRun: 40,
      trialOutcomes: [],
      probes: opts.probes ?? [],
      flags: [],
      ...score,
    },
  };
}
