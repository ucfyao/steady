import type { Ref } from 'react';
import styles from './Scene.module.css';

/** Fixed star positions (percent of the sky), so the scene is the same on every render. */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 58,
  size: i % 5 === 0 ? 3 : 2,
  alpha: 1,
}));

/** Home's wider sky (Spec 013 §2): the same stars plus fainter, smaller ones in between. */
const RICH_STARS = [
  ...STARS,
  ...Array.from({ length: 84 }, (_, i) => ({
    left: (i * 29 + 5) % 100,
    top: (i * 41 + 3) % 66,
    size: i % 7 === 0 ? 2 : 1,
    alpha: 0.45 + ((i * 13) % 5) * 0.1,
  })),
];

/**
 * The night scene behind the lantern (Spec 006 §1): sky, stars and two layers of hills.
 * Static: the game layer only sets `--dawn` (0 → 1) on it, which blends night into dawn.
 * `rich` (Home's full-width hero, Spec 013): more stars, a third hill and a glow on the
 * horizon. Focus mode never passes it, so the task's scene is unchanged.
 */
export function Scene({ ref, rich = false }: { ref?: Ref<HTMLDivElement>; rich?: boolean }) {
  const stars = rich ? RICH_STARS : STARS;
  return (
    <div
      ref={ref}
      className={rich ? `${styles.scene} ${styles.rich}` : styles.scene}
      data-testid="scene"
      aria-hidden="true"
    >
      <div className={styles.sky} />
      {rich && <div className={styles.horizon} data-testid="horizon" />}
      <div className={styles.stars}>
        {stars.map((s, i) => (
          <i
            key={i}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              ...(s.alpha < 1 && { '--alpha': s.alpha }),
            }}
          />
        ))}
      </div>
      <svg className={styles.hills} viewBox="0 0 360 200" preserveAspectRatio="none">
        {rich && (
          <path
            className={styles.distant}
            d="M0 95 C50 70 90 78 140 92 S240 60 300 80 S350 88 360 84 V200 H0Z"
          />
        )}
        <path className={styles.far} d="M0 120 C60 80 120 90 180 115 S300 70 360 100 V200 H0Z" />
        <path
          className={styles.near}
          d="M0 160 C80 130 160 150 220 140 S320 150 360 135 V200 H0Z"
        />
      </svg>
    </div>
  );
}
