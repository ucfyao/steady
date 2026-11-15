import type { GroupComparison } from '@steady/core';
import { useId } from 'react';

/**
 * Exploratory comparison (Spec 002/004): raw per-session dots per group, always with n.
 * A median is drawn only when the server sent one (n ≥ 10), and the sentence only when
 * the server says at least two groups are large enough.
 */
export function GroupDots({
  title,
  comparison,
  labels,
  show,
  format,
  sentence,
}: {
  title: string;
  comparison: GroupComparison;
  labels: Record<string, string>;
  show(value: number): number;
  format(shown: number): string;
  /** Builds the summary from the groups that have a median, in group order. */
  sentence(parts: { value: string; key: string }[]): string;
}) {
  const id = useId();
  const all = comparison.groups.flatMap((g) => g.values.map(show));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (v: number) => (all.length === 0 || hi === lo ? 50 : 4 + ((v - lo) / (hi - lo)) * 92);
  const withMedian = comparison.groups.filter((g) => g.median !== null);

  return (
    <section className="compare" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <ul className="groups">
        {comparison.groups.map((g) => (
          <li key={g.key} className="group">
            <span className="group-label">
              {labels[g.key]} · n = {g.n}
            </span>
            <span className="track" aria-hidden="true">
              {g.values.map((v, i) => (
                <span
                  key={i}
                  data-testid="group-dot"
                  className="group-dot"
                  // Staggered rows, so sessions with the same value stay visible.
                  style={{ left: `${x(show(v))}%`, top: `${2 + (i % 3) * 6}px` }}
                  title={format(show(v))}
                />
              ))}
              {g.median !== null && (
                <span
                  data-testid="group-median"
                  className="group-median"
                  style={{ left: `${x(show(g.median))}%` }}
                />
              )}
            </span>
            <span className="group-value">
              {g.median !== null ? `median ${format(show(g.median))}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="compare-note">
        {comparison.canSummarise
          ? `${sentence(
              withMedian.map((g) => ({
                value: format(show(g.median!)),
                key: g.key,
              })),
            )} This is a pattern so far, not a cause.`
          : 'Each group needs at least 10 sessions before Steady describes a pattern.'}
      </p>
    </section>
  );
}
