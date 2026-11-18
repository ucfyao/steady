import { GAME_CONFIG, type InputDevice, type Variant } from '@steady/core';
import styles from './HowToPlay.module.css';
import { Key } from './Key.js';

/** The rules in short (Spec 004, step 1): the 5 / 8 / 3 example and one paragraph. */
export function HowToPlay({ device, variant }: { device: InputDevice; variant?: Variant }) {
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
      {variant === 'game' && <PointsRules />}
    </section>
  );
}

/**
 * The points rules, for the game variant only (Spec 024). Every number comes from core's
 * GAME_CONFIG; the first multiplier is drawn like the pill in the corner of the block.
 */
function PointsRules() {
  const [first, ...rest] = GAME_CONFIG.multiplierSteps.filter(([, m]) => m > 1);
  return (
    <p className={styles.points} data-testid="points-rules">
      <b>Points.</b> {GAME_CONFIG.steadyPoints} for each digit, {GAME_CONFIG.caughtPoints} for each
      3 you hold back. In a row they multiply: <span className={styles.mult}>×{first![1]}</span>{' '}
      from {first![0]}
      {rest.map(([from, m]) => `, ×${m} from ${from}`).join('')}. A slip restarts the streak; the
      points you have stay.
    </p>
  );
}
