import { useId, type ReactNode } from 'react';
import { Button } from './Button.js';
import styles from './StatusPage.module.css';

export type StatusAction = { label: string } & ({ to: string } | { onClick(): void });

function Action({ action, primary }: { action: StatusAction; primary: boolean }) {
  const look = primary ? ({ size: 'lg' } as const) : ({ variant: 'link' } as const);
  return 'to' in action ? (
    <Button {...look} to={action.to}>
      {action.label}
    </Button>
  ) : (
    <Button {...look} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * A page that explains what happened and what to do next (Spec 004): a voided session,
 * a session that is not found, an unknown address. Title, reason, a primary action and
 * an optional secondary one.
 */
export function StatusPage({
  title,
  children,
  primary,
  secondary,
  tone = 'neutral',
}: {
  title: string;
  /** The reason, in a sentence or two. */
  children: ReactNode;
  primary: StatusAction;
  secondary?: StatusAction;
  /** `warning`: something the player did ended it (a voided session). */
  tone?: 'neutral' | 'warning';
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.page}>
      <span className={`${styles.mark} ${styles[tone]}`} aria-hidden="true">
        {tone === 'warning' ? '!' : '?'}
      </span>
      <h1 id={titleId}>{title}</h1>
      <p className={styles.reason}>{children}</p>
      <div className={styles.actions}>
        <Action action={primary} primary />
        {secondary && <Action action={secondary} primary={false} />}
      </div>
    </section>
  );
}
