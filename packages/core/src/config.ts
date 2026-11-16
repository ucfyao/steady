/**
 * Every tunable rule lives here. [R] = from published research, [P] = product decision.
 * See docs/design-note.md and specs/001-session-plan-and-scoring/spec.md.
 */
export const SART_CONFIG = {
  digits: [1, 2, 3, 4, 5, 6, 7, 8, 9] as const, // [R] Robertson et al. 1997
  targetDigit: 3, // [R]
  copiesPerDigit: 9, // [P] 81 trials, 11% no-go as in the original (Spec 005)
  stimulusMs: 250, // [R] PsyToolkit SART
  maskMs: 900, // [R]
  fontSizes: 5, // [R]

  probesPerSession: 3, // [P]
  probeGapMin: 20, // [P]
  probeGapMax: 26, // [P]
  lastProbeMaxIndex: 75, // [P] keep the final probe away from the end

  warmupTrials: 5, // [P] no targets here; excluded from RT statistics
  postProbeTrials: 3, // [P] excluded from RT statistics
  anticipationMs: 100, // [P] borrowed from the PVT false-start convention
  minRtTrials: 10, // [P] below this, RT stats are null
  preProbeWindow: 8, // [P] after Bastian & Sackur 2013
  preProbeMinTrials: 4, // [P]

  flagHighOmissionRate: 0.3, // [P] descriptive flag only
  flagAnticipationShare: 0.1, // [P] descriptive flag only
  flagRegularTimingCv: 0.05, // [P] descriptive flag only; typical human CV is far higher

  scoringVersion: 4, // 4: adds points (Spec 006); 3: 81-trial sessions (Spec 005)
} as const;

export const TRIAL_MS = SART_CONFIG.stimulusMs + SART_CONFIG.maskMs;

/** Progress rules (Spec 002). They never change how one session is scored. */
export const PROGRESS_CONFIG = {
  practiceSessions: 1, // [P] session 1 is practice: plotted, never compared
  baselineSessions: 5, // [P] initial baseline = median of sessions 2–6, fixed once set
  recentSessions: 5, // [P] recent = median of the last 5 non-practice sessions
  minGroupSize: 10, // [P] below this, no group median and no text summary
  weeklyTargetDays: 4, // [P] play on 4 of the last 7 local days (computed by the web app)
  weeklyWindowDays: 7, // [P]
  /**
   * [P] How far a value may sit from its reference (in the server's units) and still be
   * shown as "similar" on Results and Progress, so ordinary session-to-session noise is
   * not described as a change. Catch rate: one 3 of 9 is 0.111, so a single 3 is noise.
   */
  similarWithin: {
    commissionRate: 0.12,
    omissionRate: 0.03, // about 2 of 72 digits
    medianGoRtMs: 20,
    rtCv: 0.02,
  },
} as const;

/** Server-side timing plausibility for a submission (Spec 003). Technical validity: failures are rejected. */
export const SUBMIT_CONFIG = {
  // [P] elapsed time must be at least 95% of the pure trial time; probes only add time
  minElapsedMs: Math.round(
    SART_CONFIG.digits.length * SART_CONFIG.copiesPerDigit * TRIAL_MS * 0.95,
  ),
  expiresAfterMs: 30 * 60_000, // [P] an open session older than this cannot be submitted
} as const;

/**
 * Game points (Spec 006). They are not a measurement: they never change a session's metrics,
 * and the server's `scorePoints` is the only stored count.
 */
export const GAME_CONFIG = {
  steadyPoints: 10, // [P] a press on a digit, not too early
  caughtPoints: 30, // [P] a 3 held back: the hard moment pays most
  /** [P] [correct trials in a row, multiplier], ascending: ×2 from the 5th, ×3 from the 15th… */
  multiplierSteps: [
    [1, 1],
    [5, 2],
    [15, 3],
    [30, 5],
  ] as const,
} as const;
