import { PROGRESS_CONFIG, type BehaviourFlag, type CompletedSession } from '@steady/core';

export interface SessionPoint {
  session: number;
  completedAt: string;
  catchRate: number;
  omissionRate: number;
  medianGoRtMs: number | null;
  rtCv: number | null;
  practice: boolean;
  flags: BehaviourFlag[];
}

/** One chart point per session, oldest first, as the API lists them. */
export function sessionPoints(sessions: CompletedSession[]): SessionPoint[] {
  return sessions.map((s, i) => ({
    session: i + 1,
    completedAt: s.completedAt,
    catchRate: 1 - s.score.commissionRate,
    omissionRate: s.score.omissionRate,
    medianGoRtMs: s.score.medianGoRtMs,
    rtCv: s.score.rtCv,
    practice: i < PROGRESS_CONFIG.practiceSessions,
    flags: s.score.flags,
  }));
}
