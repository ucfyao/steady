import type { Variant } from '@steady/core';
import styles from './GroupTag.module.css';

/** Development only (Spec 011): a player's group after their name. */
export function GroupTag({ variant }: { variant: Variant | undefined }) {
  if (!import.meta.env.DEV || !variant) return null;
  // The space keeps the name and the group apart in the accessible name ("Ana plain").
  return (
    <>
      {' '}
      <span className={styles.tag}>{variant}</span>
    </>
  );
}
