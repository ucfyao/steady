import type { ProbeResult, TrialOutcome } from '@steady/core';

export const OUTCOME_LABELS: Record<TrialOutcome, string> = {
  steady: 'Steady press',
  caught: 'Caught a 3',
  commission: 'Pressed on a 3',
  omission: 'Missed a digit',
  anticipation: 'Too early',
};

export const ANSWER_LABELS = {
  on_task: 'On task',
  drifting: 'Drifting',
  elsewhere: 'Elsewhere',
} as const;

/** Where the server's longest steady run sits: the first stretch of that length. */
function longestRun(outcomes: TrialOutcome[], length: number): Set<number> {
  let start = 0;
  for (let i = 0; i < outcomes.length; i++) {
    const ok = outcomes[i] === 'steady' || outcomes[i] === 'caught';
    if (!ok) start = i + 1;
    else if (length > 0 && i - start + 1 === length) {
      return new Set(Array.from({ length }, (_, k) => start + k));
    }
  }
  return new Set();
}

/**
 * The session journey (Spec 004): one cell per trial, coloured by the server's outcome,
 * with the longest steady run underlined and a marker after each probe trial.
 */
export function JourneyRibbon({
  outcomes,
  probes,
  longestSteadyRun,
  summary,
}: {
  outcomes: TrialOutcome[];
  probes: ProbeResult[];
  longestSteadyRun: number;
  summary: string;
}) {
  const run = longestRun(outcomes, longestSteadyRun);
  const probeAt = new Map(probes.map((p) => [p.afterIndex, p.answer]));

  return (
    <figure className="journey">
      <div className="ribbon" role="img" aria-label={summary}>
        {outcomes.map((outcome, i) => {
          const answer = probeAt.get(i);
          return (
            <span
              key={i}
              data-testid="trial"
              data-outcome={outcome}
              data-longest={run.has(i) ? 'true' : undefined}
              className={`cell cell-${outcome}`}
              title={`Trial ${i + 1}: ${OUTCOME_LABELS[outcome]}`}
            >
              {answer && (
                <span
                  data-testid="probe"
                  data-answer={answer}
                  className={`probe-mark probe-${answer}`}
                  title={`Asked after trial ${i + 1}: ${ANSWER_LABELS[answer]}`}
                />
              )}
            </span>
          );
        })}
      </div>
      <figcaption className="legend">
        <ul>
          {(Object.keys(OUTCOME_LABELS) as TrialOutcome[]).map((o) => (
            <li key={o}>
              <span className={`swatch cell-${o}`} aria-hidden="true" />
              {OUTCOME_LABELS[o]}
            </li>
          ))}
          <li>
            <span className="swatch swatch-run" aria-hidden="true" />
            Longest steady run
          </li>
        </ul>
        <ul>
          <li className="legend-title">Where your mind was:</li>
          {(Object.keys(ANSWER_LABELS) as (keyof typeof ANSWER_LABELS)[]).map((a) => (
            <li key={a}>
              <span className={`probe-mark probe-${a}`} aria-hidden="true" />
              {ANSWER_LABELS[a]}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
