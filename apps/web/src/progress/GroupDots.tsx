import { PROGRESS_CONFIG, type GroupComparison } from '@steady/core';
import { useId, type ReactNode } from 'react';
import { yAxis } from './axis.js';
import styles from './GroupDots.module.css';

/**
 * How many more values the two largest groups still lack before two of them reach
 * `minGroupSize`, the point where the server returns medians and `canSummarise`.
 */
export function missingForComparison(comparison: GroupComparison): number {
  const [a = 0, b = 0] = comparison.groups.map((g) => g.n).sort((x, y) => y - x);
  const min = PROGRESS_CONFIG.minGroupSize;
  return Math.max(0, min - a) + Math.max(0, min - b);
}

/**
 * Exploratory comparison (Spec 004): until two groups have enough values, only how many
 * more are needed. Then the groups with a median (the server's, n ≥ 10), each as raw dots
 * with n and its median, on one axis with ticks; smaller groups are listed, not drawn, so
 * every group shown has a median. One sentence describes the medians, never a cause.
 */
export function GroupDots({
  title,
  heading: Heading = 'h4',
  comparison,
  labels,
  show,
  axisFormat,
  format,
  axisTitle,
  unit,
  needMore,
  sentence,
  children,
}: {
  title: string;
  heading?: 'h3' | 'h4';
  comparison: GroupComparison;
  labels: Record<string, string>;
  show(value: number): number;
  /** Tick labels, with decimals when whole numbers would repeat. */
  axisFormat(shown: number, decimals?: number): string;
  format(shown: number): string;
  axisTitle: string;
  /** What a value is: "sessions" or "answers". */
  unit: string;
  /** The text while the comparison is collapsed, given the missing count. */
  needMore(missing: number): string;
  /** Builds the summary from the groups that have a median, in group order. */
  sentence(parts: { value: string; key: string }[]): string;
  /** What this part compares, shown above it. */
  children?: ReactNode;
}) {
  const id = useId();
  const shownGroups = comparison.groups.filter((g) => g.median !== null);
  const hidden = comparison.groups.filter((g) => g.median === null);

  if (!comparison.canSummarise)
    return (
      <section className={styles.compare} aria-labelledby={id}>
        <Heading id={id}>{title}</Heading>
        {children}
        <p className={styles.needMore}>{needMore(missingForComparison(comparison))}</p>
      </section>
    );

  const values = shownGroups.flatMap((g) => [...g.values, g.median!].map(show));
  const axis = yAxis(values, axisFormat)!;
  const lo = axis.ticks[0]!;
  const hi = axis.ticks.at(-1)!;
  const x = (v: number) => 4 + ((v - lo) / (hi - lo)) * 92;

  return (
    <section className={styles.compare} aria-labelledby={id}>
      <Heading id={id}>{title}</Heading>
      {children}
      <ul className={styles.groups}>
        {shownGroups.map((g) => (
          <li key={g.key} className={styles.group}>
            <span className={styles.label}>
              {labels[g.key]} · n = {g.n}
            </span>
            <span className={styles.track} aria-hidden="true">
              {axis.ticks.map((t) => (
                <span key={t} className={styles.grid} style={{ left: `${x(t)}%` }} />
              ))}
              {g.values.map((v, i) => (
                <span
                  key={i}
                  data-testid="group-dot"
                  className={styles.dot}
                  // Staggered rows, so sessions with the same value stay visible.
                  style={{ left: `${x(show(v))}%`, top: `${2 + (i % 3) * 6}px` }}
                  title={format(show(v))}
                />
              ))}
              <span
                data-testid="group-median"
                className={styles.median}
                style={{ left: `${x(show(g.median!))}%` }}
              />
            </span>
            <span className={styles.value}>
              median <span className={styles.number}>{format(show(g.median!))}</span>
            </span>
          </li>
        ))}
        <li className={styles.axisRow} aria-hidden="true">
          <span className={styles.axis}>
            {axis.ticks.map((t, i) => (
              <span
                key={t}
                data-testid="axis-tick"
                className={styles.tick}
                style={{ left: `${x(t)}%` }}
              >
                {axis.labels[i]}
              </span>
            ))}
          </span>
        </li>
      </ul>
      <p className={styles.axisTitle}>{axisTitle}</p>
      {hidden.length > 0 && (
        <p className={styles.note}>
          Not shown yet (fewer than {PROGRESS_CONFIG.minGroupSize} {unit}):{' '}
          {hidden.map((g) => `${labels[g.key]}, n = ${g.n}`).join('; ')}
        </p>
      )}
      <p className={styles.note}>
        {sentence(shownGroups.map((g) => ({ value: format(show(g.median!)), key: g.key })))} This is
        a pattern so far, not a cause.
      </p>
    </section>
  );
}
