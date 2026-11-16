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

/**
 * The highest dawn among game sessions, or null without one (Spec 007). Dawn, not points:
 * an all-correct session's points depend on where the 3s fall, so a points record could come
 * from the sequence rather than the play. It is game progress, not a measurement.
 */
export function personalBest(sessions: readonly CompletedSession[]): number | null {
  const dawns = sessions.filter((s) => s.variant === 'game').map((s) => dawnPercent(s.score));
  return dawns.length ? Math.max(...dawns) : null;
}
