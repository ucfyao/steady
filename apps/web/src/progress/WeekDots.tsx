import { weeklyTarget } from './weekly.js';

/** "X of 4 days this week" with one dot per local day, today last (Spec 004). */
export function WeekDots({ completedAt, now = new Date() }: { completedAt: string[]; now?: Date }) {
  const { days, count, target } = weeklyTarget(completedAt, now);
  const labelOf = (k: number) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (days.length - 1 - k),
    ).toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <div className="week">
      <p className="week-count">
        {count >= target
          ? `Goal reached: ${count} days this week`
          : `${count} of ${target} days this week`}
      </p>
      <ol className="week-days" aria-hidden="true">
        {days.map((played, k) => (
          <li key={k} data-testid="week-day" className={played ? 'played' : undefined}>
            <span className="week-dot" />
            <span className="week-label">{labelOf(k)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
