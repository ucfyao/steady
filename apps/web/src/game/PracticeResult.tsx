import type { InputDevice } from '@steady/core';
import { useId } from 'react';
import { Button } from '../ui/Button.js';
import { practiceTip, type PracticeSummary } from './practice.js';
import styles from './PracticeResult.module.css';
import { Steps } from './Steps.js';

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
        ? `One digit passed without a press. ${press} for every digit except 3: a press still counts after the digit turns into ⊗.`
        : `${s.missed} digits passed without a press. ${press} for every digit except 3: a press still counts after the digit turns into ⊗.`;
    case 'too-early':
      return `${s.tooEarly === 1 ? 'One press' : `${s.tooEarly} presses`} came before the digit could really be seen. Wait for each digit, then ${press.toLowerCase()}.`;
    case 'clean':
      return 'No slips. The real check runs at full speed the whole way, so a few slips there are normal.';
  }
}

/** Step 2 (Spec 004): how the practice went, counted in the browser, plus one tip. */
export function PracticeResult({
  summary,
  device,
  onReady,
  onAgain,
}: {
  summary: PracticeSummary;
  device: InputDevice;
  onReady(): void;
  onAgain(): void;
}) {
  const tipId = useId();
  const stat = (label: string, value: string) => (
    <div role="group" aria-label={label} className={styles.stat}>
      <b>{value}</b>
      <small aria-hidden="true">{label}</small>
    </div>
  );
  return (
    <section className={styles.result}>
      <Steps step={2} label="Practice done" />
      <h1>Nice warm-up</h1>
      <p className={styles.lead}>Here is how the practice went. Nothing was saved.</p>
      <div className={styles.stats}>
        {stat('3s held back', `${summary.heldBack} / ${summary.targets}`)}
        {stat('digits caught', `${summary.caught} / ${summary.digits}`)}
        {stat('too early', String(summary.tooEarly))}
      </div>
      <aside role="note" aria-labelledby={tipId} className={styles.tip}>
        <b id={tipId}>One tip</b>
        <p>{tipText(summary, device)}</p>
      </aside>
      <Button size="lg" onClick={onReady}>
        I&apos;m ready
      </Button>
      <Button variant="link" onClick={onAgain} className={styles.again}>
        Practice again
      </Button>
    </section>
  );
}
