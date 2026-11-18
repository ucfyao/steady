import type { TrialOutcome } from '@steady/core';
import ribbon from '../results/JourneyRibbon.module.css';
import styles from './TrialCells.module.css';

/** A cell's classes: the session journey's outcome colours, or an empty outline. */
function cellClass(outcome: TrialOutcome | undefined): string {
  return outcome ? `${styles.cell} ${ribbon[outcome]}` : `${styles.cell} ${styles.pending}`;
}

/** Fills one cell in place, outside React (the block writes outcomes straight into the DOM). */
export function markCell(el: HTMLElement | undefined, outcome: TrialOutcome): void {
  if (!el) return;
  el.dataset.outcome = outcome;
  el.className = cellClass(outcome);
}

/**
 * One cell per practice trial, in the session journey's cell style (Spec 023). Empty until
 * the trial's outcome is known. The same for every group: only the page's tokens differ.
 */
export function TrialCells({
  outcomes,
  testId,
  className,
}: {
  outcomes: (TrialOutcome | undefined)[];
  testId?: string;
  className?: string;
}) {
  return (
    <div className={className ? `${styles.cells} ${className}` : styles.cells} data-testid={testId}>
      {outcomes.map((outcome, i) => (
        <span key={i} data-testid="cell" data-outcome={outcome} className={cellClass(outcome)} />
      ))}
    </div>
  );
}
