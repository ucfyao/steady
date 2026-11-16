import { dayLetter } from './lastCheck.js';
import { weeklyTarget } from './weekly.js';
import styles from './WeekDots.module.css';

/**
 * "3 of 4 days" with one dot per local day, today last (Spec 004). Played days are
 * filled; today has a dashed ring until it is played.
 */
export function WeekDots({ completedAt, now = new Date() }: { completedAt: string[]; now?: Date }) {
  const { days, count, target } = weeklyTarget(completedAt, now);
  const dayOf = (k: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days.length - 1 - k));

  return (
    <div>
      <p className={styles.count}>
        <span className={styles.number}>{count}</span>{' '}
        {count >= target ? 'days, goal reached' : `of ${target} days`}
      </p>
      <ol className={styles.days} aria-hidden="true">
        {days.map((played, k) => (
          <li
            key={k}
            data-testid="week-day"
            data-played={played}
            data-today={k === days.length - 1}
            className={styles.day}
          >
            {dayLetter(dayOf(k))}
          </li>
        ))}
      </ol>
    </div>
  );
}
