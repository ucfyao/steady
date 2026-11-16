import type { ProbeResult, TrialOutcome } from '@steady/core';
import styles from './JourneyRibbon.module.css';

export const OUTCOME_LABELS: Record<TrialOutcome, string> = {
  steady: 'Steady press',
  caught: 'Held back on a 3',
  commission: 'Pressed on a 3',
  omission: 'Missed a digit',
  anticipation: 'Too early',
};

export const ANSWER_LABELS = {
  on_task: 'On task',
  drifting: 'Drifting',
  elsewhere: 'Elsewhere',
} as const;

/** The session in time order, in three equal parts (about 30 seconds each). */
const PARTS = ['Start', 'Middle', 'End'] as const;

/** Slips counted in a part's caption, in this order. */
const SLIPS: [TrialOutcome, string][] = [
  ['commission', 'pressed on a 3'],
  ['omission', 'missed'],
  ['anticipation', 'too early'],
];

/** "1 pressed on a 3 · 2 missed", or "No slips". Counts the server's outcomes. */
function partCaption(outcomes: TrialOutcome[]): string {
  const slips = SLIPS.flatMap(([o, words]) => {
    const n = outcomes.filter((x) => x === o).length;
    return n ? [`${n} ${words}`] : [];
  });
  return slips.length ? slips.join(' · ') : 'No slips';
}

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
 * The session journey (Spec 004): one cell per trial, coloured by the server's outcome, in
 * three labelled parts (start, middle, end). Cells wrap to the width, so a phone gets
 * readable cells instead of 27 slivers. The longest steady run is underlined and a marker
 * after each probe trial shows the answer. The legend lists only what happened.
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
  const size = Math.ceil(outcomes.length / PARTS.length);
  const parts = PARTS.map((label, k) => ({
    label,
    from: k * size,
    outcomes: outcomes.slice(k * size, (k + 1) * size),
  })).filter((p) => p.outcomes.length > 0);
  const label = `${summary} ${parts.map((p) => `${p.label}: ${partCaption(p.outcomes)}.`).join(' ')}`;

  const seen = new Set(outcomes);
  const answers = new Set(probes.map((p) => p.answer));

  return (
    <figure className={styles.journey}>
      <div className={styles.parts} role="img" aria-label={label}>
        {parts.map((part) => (
          <div key={part.label} data-testid="segment" data-label={part.label}>
            <p className={styles.partLabel}>
              <span className={styles.partName}>{part.label}</span>
              <span>{partCaption(part.outcomes)}</span>
            </p>
            <div className={styles.ribbon}>
              {part.outcomes.map((outcome, j) => {
                const i = part.from + j;
                const answer = probeAt.get(i);
                return (
                  <span
                    key={i}
                    data-testid="trial"
                    data-outcome={outcome}
                    data-longest={run.has(i) ? 'true' : undefined}
                    className={`${styles.cell} ${styles[outcome]}`}
                    title={`Trial ${i + 1}: ${OUTCOME_LABELS[outcome]}`}
                  >
                    {answer && (
                      <span
                        data-testid="probe"
                        data-answer={answer}
                        className={`${styles.probe} ${styles[answer]}`}
                        title={`Asked after trial ${i + 1}: ${ANSWER_LABELS[answer]}`}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <figcaption className={styles.legend} data-testid="legend">
        <ul>
          {(Object.keys(OUTCOME_LABELS) as TrialOutcome[])
            .filter((o) => seen.has(o))
            .map((o) => (
              <li key={o}>
                <span className={`${styles.swatch} ${styles[o]}`} aria-hidden="true" />
                {OUTCOME_LABELS[o]}
              </li>
            ))}
          {run.size > 0 && (
            <li>
              <span className={styles.run} aria-hidden="true" />
              Longest steady run
            </li>
          )}
        </ul>
        {answers.size > 0 && (
          <ul>
            <li className={styles.legendTitle}>Where your mind was:</li>
            {(Object.keys(ANSWER_LABELS) as (keyof typeof ANSWER_LABELS)[])
              .filter((a) => answers.has(a))
              .map((a) => (
                <li key={a}>
                  <span className={`${styles.probe} ${styles[a]}`} aria-hidden="true" />
                  {ANSWER_LABELS[a]}
                </li>
              ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}
