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

  scoringVersion: 1,
} as const;

export const TRIAL_MS = SART_CONFIG.stimulusMs + SART_CONFIG.maskMs;

/** Progress rules (Spec 002). They never change how one session is scored. */
export const PROGRESS_CONFIG = {
  practiceSessions: 1, // [P] session 1 is practice: plotted, never compared
  baselineSessions: 5, // [P] initial baseline = median of sessions 2–6, fixed once set
  recentSessions: 5, // [P] recent = median of the last 5 non-practice sessions
  minGroupSize: 10, // [P] below this, no group median and no text summary
} as const;
