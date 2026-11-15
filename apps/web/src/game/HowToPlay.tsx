import type { InputDevice } from '@steady/core';
import styles from './HowToPlay.module.css';

const MASK = '⊗';

/** The rules, shown before practice and from "How to play" (Spec 004). */
export function HowToPlay({ device }: { device: InputDevice }) {
  const action = device === 'touch' ? 'Tap the screen' : 'Press Space';
  const press = device === 'touch' ? 'Tap' : 'Press';
  return (
    <section className={styles.howTo} aria-labelledby="how-to-title">
      <h2 id="how-to-title">How to play</h2>
      <ol className={styles.steps}>
        <li>
          A digit flashes in the middle of the screen, then turns into{' '}
          <span className={styles.mask}>{MASK}</span>.
        </li>
        <li>
          <strong>{action}</strong> for every digit, as soon as you see it.
        </li>
        <li>
          <strong>But not for 3.</strong> When you see a 3, hold back.
        </li>
        <li>A press still counts while {MASK} is showing, so you have just over a second.</li>
      </ol>
      <div className={styles.example} aria-hidden="true">
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
      <p className={styles.note}>
        3s are rare and come fast, so everyone presses on some of them by habit. That is what this
        check measures. Speed and accuracy matter equally.
      </p>
    </section>
  );
}
