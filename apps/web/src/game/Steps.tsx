import styles from './Steps.module.css';

const TOTAL = 3;

/**
 * "Step N of 3" and a three-part bar, on the screens before a session (Spec 004).
 * Never inside the block: focus mode shows no progress of any kind.
 */
export function Steps({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <div className={styles.steps}>
      <p className={styles.label}>
        <b>
          Step {step} of {TOTAL}
        </b>{' '}
        · {label}
      </p>
      <div className={styles.bar} aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <i key={i} className={i < step ? styles.on : undefined} />
        ))}
      </div>
    </div>
  );
}
