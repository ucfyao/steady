import type { ReactNode } from 'react';
import styles from './Notice.module.css';

/** A short status message in a quiet bar, with a close button when it can be dismissed. */
export function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?(): void }) {
  return (
    <div role="status" className={styles.notice}>
      <p className={styles.text}>{children}</p>
      {onDismiss && (
        <button type="button" className={styles.close} aria-label="Dismiss" onClick={onDismiss}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2L10 10M10 2L2 10" />
          </svg>
        </button>
      )}
    </div>
  );
}
