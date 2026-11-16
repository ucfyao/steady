import styles from './Loading.module.css';

/**
 * A waiting state (Spec 004): centred, with a slow breathing ring. Under
 * `prefers-reduced-motion` the ring stands still.
 */
export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className={styles.loading}>
      <span className={styles.ring} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  );
}
