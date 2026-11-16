import type { Ref } from 'react';
import styles from './Scene.module.css';

/** Fixed star positions (percent of the sky), so the scene is the same on every render. */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 58,
  size: i % 5 === 0 ? 3 : 2,
}));

/**
 * The night scene behind the lantern (Spec 006 §1): sky, stars and two layers of hills.
 * Static: the game layer only sets `--dawn` (0 → 1) on it, which blends night into dawn.
 */
export function Scene({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={styles.scene} data-testid="scene" aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.stars}>
        {STARS.map((s, i) => (
          <i
            key={i}
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          />
        ))}
      </div>
      <svg className={styles.hills} viewBox="0 0 360 200" preserveAspectRatio="none">
        <path className={styles.far} d="M0 120 C60 80 120 90 180 115 S300 70 360 100 V200 H0Z" />
        <path
          className={styles.near}
          d="M0 160 C80 130 160 150 220 140 S320 150 360 135 V200 H0Z"
        />
      </svg>
    </div>
  );
}
