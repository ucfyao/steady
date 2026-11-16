import { maxPoints, scorePoints, type CompletedSession, type SessionScore } from '@steady/core';

/** A session's game points, from its outcomes (Spec 006: points are never stored). */
export function sessionPoints(score: Pick<SessionScore, 'trialOutcomes'>): number {
  return scorePoints(score.trialOutcomes);
}

/**
 * How far the sky got towards dawn, 0–100 (Spec 007 §4): the session's points out of the
 * points of an all-correct session of the same trials, rounded down.
 */
export function dawnPercent(score: Pick<SessionScore, 'trialOutcomes'>): number {
  const best = maxPoints(
    score.trialOutcomes.map((o) => ({ isTarget: o === 'caught' || o === 'commission' })),
  );
  return best > 0 ? Math.floor((sessionPoints(score) / best) * 100) : 0;
}

/** The largest points among game sessions, or null without one. */
export function personalBest(sessions: readonly CompletedSession[]): number | null {
  const points = sessions.filter((s) => s.variant === 'game').map((s) => sessionPoints(s.score));
  return points.length ? Math.max(...points) : null;
}
