import { maxPoints, type CompletedSession, type SessionScore } from '@steady/core';

/**
 * How far the sky got towards dawn, 0–100 (Spec 007 §4): the server's points out of the
 * points of an all-correct session of the same trials, rounded down.
 */
export function dawnPercent(score: Pick<SessionScore, 'points' | 'trialOutcomes'>): number {
  const best = maxPoints(
    score.trialOutcomes.map((o) => ({ isTarget: o === 'caught' || o === 'commission' })),
  );
  return best > 0 ? Math.floor((score.points / best) * 100) : 0;
}

/** The largest points among game sessions, or null without one. */
export function personalBest(sessions: readonly CompletedSession[]): number | null {
  const points = sessions.filter((s) => s.variant === 'game').map((s) => s.score.points);
  return points.length ? Math.max(...points) : null;
}
