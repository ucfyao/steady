import type { CompletedSession } from '@steady/core';
import { Link, useLocation } from 'react-router';

/** Placeholder until Spec 004 part 3 builds the full results screen. */
export function Results() {
  const session = (useLocation().state as { session?: CompletedSession } | null)?.session;
  return (
    <section>
      <h1>Session saved</h1>
      {session && (
        <p>
          You caught {14 - session.score.commissions} of 14 threes. Longest steady run:{' '}
          {session.score.longestSteadyRun} trials.
        </p>
      )}
      <Link to="/">Back to home</Link>
    </section>
  );
}
