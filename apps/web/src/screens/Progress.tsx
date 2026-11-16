import type { CompletedSession, ProgressMetric, ProgressResponse } from '@steady/core';
import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import { GroupDots } from '../progress/GroupDots.js';
import { MetricChart } from '../progress/MetricChart.js';
import { METRIC_VIEWS, metricView } from '../progress/metrics.js';
import { sessionPoints, type SessionPoint } from '../progress/series.js';
import { WeekDots } from '../progress/WeekDots.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { ChipGroup } from '../ui/ChipGroup.js';
import styles from './Progress.module.css';

type State =
  | { k: 'loading' }
  | { k: 'error'; message: string }
  | { k: 'ready'; sessions: CompletedSession[]; progress: ProgressResponse };

const SLEEP = { poor: 'Poor', ok: 'OK', good: 'Good' };
const STRESS = { low: 'Low', medium: 'Medium', high: 'High' };
const ANSWERS = { on_task: 'On task', drifting: 'Drifting', elsewhere: 'Elsewhere' };
/** The group names inside a sentence. */
const IN_SENTENCE: Record<string, string> = {
  poor: 'poor',
  ok: 'OK',
  good: 'good',
  low: 'low',
  medium: 'medium',
  high: 'high',
  on_task: 'on task',
  drifting: 'drifting',
  elsewhere: 'elsewhere',
};

/** "a", "a and b", "a, b and c" */
const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const POINT_VALUE: Record<ProgressMetric, (p: SessionPoint) => number | null> = {
  commissionRate: (p) => p.catchRate,
  omissionRate: (p) => p.omissionRate,
  medianGoRtMs: (p) => p.medianGoRtMs,
  rtCv: (p) => p.rtCv,
};

export const moreSessions = (n: number) => `${n} more session${n === 1 ? '' : 's'}`;

export function Progress() {
  const { api } = usePlayers();
  const [state, setState] = useState<State>({ k: 'loading' });
  const [metric, setMetric] = useState<ProgressMetric>('commissionRate');

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress()])
      .then(([sessions, progress]) => !cancelled && setState({ k: 'ready', sessions, progress }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setState({ k: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (state.k === 'loading') return <p>Loading…</p>;
  if (state.k === 'error')
    return (
      <div role="alert" className="error">
        <p>{state.message}</p>
      </div>
    );

  const { sessions, progress } = state;
  if (sessions.length === 0)
    return (
      <section className={styles.progress}>
        <h1>Progress</h1>
        <p className={styles.lead}>
          No sessions yet. Your progress appears here after your first check.
        </p>
        <Button to="/play" size="lg">
          Start today&apos;s check
        </Button>
      </section>
    );

  const { summary } = progress;
  const points = sessionPoints(sessions);
  const view = metricView(metric);

  return (
    <section className={styles.progress}>
      <h1>Progress</h1>

      <Card as="section" aria-labelledby="week-title">
        <h2 id="week-title">This week</h2>
        <WeekDots completedAt={sessions.map((s) => s.completedAt)} />
      </Card>

      <Card as="section" aria-labelledby="recent-title">
        <h2 id="recent-title">Recent vs. where you started</h2>
        {summary.baseline && summary.recent ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Where you started</th>
                <th scope="col">Recent</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_VIEWS.map((m) => {
                const shown = (s: { median: number | null; n: number }) => (
                  <>
                    <span className={styles.number}>
                      {s.median === null ? '–' : m.format(m.show(s.median))}
                    </span>{' '}
                    <span className={styles.n}>(n = {s.n})</span>
                  </>
                );
                return (
                  <tr key={m.key}>
                    <th scope="row">
                      {m.label}
                      {m.hint && <span className={styles.rowHint}>{m.hint}</span>}
                    </th>
                    <td>{shown(summary.baseline![m.key])}</td>
                    <td>{shown(summary.recent![m.key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <>
            <p>Your starting point is set after {moreSessions(summary.sessionsUntilBaseline)}.</p>
            <p className={styles.note}>
              Session 1 is practice; sessions 2–6 set where you started.
            </p>
          </>
        )}
      </Card>

      <section aria-labelledby="time-title" className={styles.block}>
        <h2 id="time-title">Over time</h2>
        <p className={styles.note}>Speed and accuracy side by side, one point per session.</p>
        <ul className={styles.legend}>
          <li>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="3.5" className={styles.keyNormal} />
            </svg>
            A session
          </li>
          <li>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="4" className={styles.keyPractice} />
            </svg>
            Practice
          </li>
          <li>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1L11 6L6 11L1 6Z" className={styles.keyFlagged} />
            </svg>
            Has a note (see the tooltip)
          </li>
          <li>
            <svg viewBox="0 0 16 12" aria-hidden="true">
              <line x1="0" y1="6" x2="16" y2="6" className={styles.keyBaseline} />
            </svg>
            Where you started
          </li>
        </ul>
        <div className={styles.charts}>
          {METRIC_VIEWS.map((m) => {
            const b = summary.baseline?.[m.key].median ?? null;
            return (
              <MetricChart
                key={m.key}
                view={m}
                points={points}
                value={POINT_VALUE[m.key]}
                baseline={b === null ? null : m.show(b)}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="explore-title" className={styles.block}>
        <h2 id="explore-title">Exploring patterns</h2>
        <p className={styles.note}>
          Exploratory: each dot is one session. Sessions after a check-in are grouped by your
          answer. Practice is left out.
        </p>
        <ChipGroup<ProgressMetric>
          legend="Compare"
          name="compare"
          options={METRIC_VIEWS.map((m) => ({ value: m.key, label: m.label }))}
          value={metric}
          onChange={setMetric}
        />
        <GroupDots
          title="Sleep"
          comparison={progress.checkIn.sleep[metric]}
          labels={SLEEP}
          show={view.show}
          format={view.format}
          sentence={(parts) =>
            `So far, your median ${view.label.toLowerCase()} was ${list(
              parts.map((p) => `${p.value} after ${IN_SENTENCE[p.key]} sleep`),
            )}.`
          }
        />
        <GroupDots
          title="Stress"
          comparison={progress.checkIn.stress[metric]}
          labels={STRESS}
          show={view.show}
          format={view.format}
          sentence={(parts) =>
            `So far, your median ${view.label.toLowerCase()} was ${list(
              parts.map((p) => `${p.value} on ${IN_SENTENCE[p.key]} stress days`),
            )}.`
          }
        />
        <GroupDots
          title='Before each "where was your mind?"'
          comparison={progress.preProbe}
          labels={ANSWERS}
          show={(v) => v}
          format={(v) => `${Math.round(v * 100)}%`}
          sentence={(parts) =>
            `So far, your rhythm variability just before a probe had a median of ${list(
              parts.map((p) => `${p.value} when you answered ${IN_SENTENCE[p.key]}`),
            )}.`
          }
        />
      </section>
    </section>
  );
}
