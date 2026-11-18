import type { InputDevice, TrialOutcome } from '@steady/core';
import { useId } from 'react';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { practiceTip, type PracticeSummary } from './practice.js';
import styles from './PracticeLine.module.css';
import { OUTCOME_LABELS } from '../results/JourneyRibbon.js';
import ribbon from '../results/JourneyRibbon.module.css';
import { TrialCells } from './TrialCells.js';

function tipText(s: PracticeSummary, device: InputDevice): string {
  const press = device === 'touch' ? 'Tap' : 'Press';
  switch (practiceTip(s)) {
    case 'pressed-3': {
      const which =
        s.pressedOn3 === 1 ? 'one 3' : s.pressedOn3 === s.targets ? 'every 3' : 'some 3s';
      return `You pressed on ${which}. That is normal: in the real check they are rare and come at full speed.`;
    }
    case 'missed':
      return s.missed === 1
        ? `One digit passed without a press. ${press} for every digit except 3: a press still counts after the glass mists over.`
        : `${s.missed} digits passed without a press. ${press} for every digit except 3: a press still counts after the glass mists over.`;
    case 'too-early':
      return `${s.tooEarly === 1 ? 'One press' : `${s.tooEarly} presses`} came before the digit could really be seen. Wait for each digit, then ${press.toLowerCase()}.`;
    case 'clean':
      return 'No slips. The real check runs at full speed the whole way, so a few slips there are normal.';
  }
}

/** "Practice: 2 of 2 3s held back · 9 of 10 digits caught", plus "· N too early" if any. */
export function practiceLine(s: PracticeSummary): string {
  const parts = [
    `${s.heldBack} of ${s.targets} 3s held back`,
    `${s.caught} of ${s.digits} digits caught`,
  ];
  if (s.tooEarly > 0) parts.push(`${s.tooEarly} too early`);
  return `Practice: ${parts.join(' · ')}`;
}

/**
 * How the practice went, at the top of "Before you start" (Specs 005, 023): a card with the
 * practice's cells, two numbers, one tip and Practice again. Counted in the browser for this
 * screen only; never sent or stored. Screen readers get the one sentence.
 */
export function PracticeLine({
  summary,
  outcomes,
  device,
  onAgain,
}: {
  summary: PracticeSummary;
  outcomes: TrialOutcome[];
  device: InputDevice;
  onAgain(): void;
}) {
  const tipId = useId();
  return (
    <Card as="section" className={styles.practice} aria-label="How the practice went">
      <p data-testid="practice-line" className="visually-hidden">
        {practiceLine(summary)}
      </p>
      <div aria-hidden="true">
        <TrialCells outcomes={outcomes} className={styles.cells} />
        {/* What the colours mean: only what happened, as on Results. */}
        <ul className={styles.legend} data-testid="legend">
          {(Object.keys(OUTCOME_LABELS) as TrialOutcome[])
            .filter((o) => outcomes.includes(o))
            .map((o) => (
              <li key={o}>
                <span className={`${ribbon.swatch} ${ribbon[o]}`} />
                {OUTCOME_LABELS[o]}
              </li>
            ))}
        </ul>
        <dl className={styles.numbers}>
          <div data-testid="held-back">
            <dt>3s held back</dt>
            <dd>
              {summary.heldBack} <span>of {summary.targets}</span>
            </dd>
          </div>
          <div data-testid="caught">
            <dt>Digits caught</dt>
            <dd>
              {summary.caught} <span>of {summary.digits}</span>
            </dd>
          </div>
          {summary.tooEarly > 0 && (
            <div data-testid="too-early">
              <dt>Too early</dt>
              <dd>{summary.tooEarly}</dd>
            </div>
          )}
        </dl>
      </div>
      <aside role="note" aria-labelledby={tipId} className={styles.tip}>
        <b id={tipId}>One tip</b>
        <p>{tipText(summary, device)}</p>
      </aside>
      <Button variant="link" onClick={onAgain} className={styles.again}>
        Practice again
      </Button>
    </Card>
  );
}
