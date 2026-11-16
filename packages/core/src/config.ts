/**
 * Every tunable rule lives here. [R] = from published research, [P] = product decision.
 * See docs/design-note.md and specs/001-session-plan-and-scoring/spec.md.
 */
export const SART_CONFIG = {
  digits: [1, 2, 3, 4, 5, 6, 7, 8, 9] as const, // [R] Robertson et al. 1997
  targetDigit: 3, // [R]
  copiesPerDigit: 14, // [P] 126 trials, 11% no-go as in the original
  stimulusMs: 250, // [R] PsyToolkit SART
  maskMs: 900, // [R]
  fontSizes: 5, // [R]

  probesPerSession: 4, // [P]
  probeGapMin: 25, // [P]
  probeGapMax: 35, // [P]
  lastProbeMaxIndex: 120, // [P] keep the final probe away from the end

  warmupTrials: 5, // [P] no targets here; excluded from RT statistics
  postProbeTrials: 3, // [P] excluded from RT statistics
  anticipationMs: 100, // [P] borrowed from the PVT false-start convention
  minRtTrials: 10, // [P] below this, RT stats are null
  preProbeWindow: 8, // [P] after Bastian & Sackur 2013
  preProbeMinTrials: 4, // [P]

  flagHighOmissionRate: 0.3, // [P] descriptive flag only
  flagAnticipationShare: 0.1, // [P] descriptive flag only
  flagRegularTimingCv: 0.05, // [P] descriptive flag only; typical human CV is far higher

  scoringVersion: 2, // 2: adds trialOutcomes (Spec 001 § Versioning)
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
   * not described as a change. Catch rate: 0.1 is about one 3 of 14, so a single 3 is noise.
   */
  similarWithin: {
    commissionRate: 0.1,
    omissionRate: 0.02, // about 2 of 112 digits
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
