import type { ReactNode } from 'react';
import styles from './Key.module.css';

/**
 * The key a player presses, drawn as a keycap (Spec 020). The same for every group: only the
 * page's colour tokens change it. `moving` is set only before the first digit (How it works,
 * the countdown's Ready and Set), never while trials run.
 */
export function Key({ children, moving = false }: { children: ReactNode; moving?: boolean }) {
  return (
    <kbd className={styles.key} data-moving={moving}>
      {children}
    </kbd>
  );
}
