import type { InputDevice } from '@steady/core';
import styles from './HowToPlay.module.css';
import { Key } from './Key.js';

/** The rules in short (Spec 004, step 1): the 5 / 8 / 3 example and one paragraph. */
export function HowToPlay({ device }: { device: InputDevice }) {
  const press = device === 'touch' ? 'Tap' : 'Press';
  return (
    <section className={styles.howTo} aria-label="How to play">
      <div className={styles.example}>
        <figure>
          <span className={styles.digit}>5</span>
          <figcaption>{press}</figcaption>
        </figure>
        <figure>
          <span className={styles.digit}>8</span>
          <figcaption>{press}</figcaption>
        </figure>
        <figure className={styles.target}>
          <span className={styles.digit}>3</span>
          <figcaption>Hold back</figcaption>
        </figure>
      </div>
      <p className={styles.rule}>
        {device === 'touch' ? (
          <>
            <Key moving>Tap</Key> the screen
          </>
        ) : (
          <>
            Press <Key moving>Space</Key>
          </>
        )}{' '}
        as soon as you see a digit. 3s are rare, so your finger will want to press anyway. That
        moment is what Steady measures.
      </p>
    </section>
  );
}
