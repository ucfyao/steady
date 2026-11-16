import {
  type Variant,
  PROGRESS_CONFIG,
  SART_CONFIG,
  type CompletedSession,
  type MetricSet,
  type ProgressMetric,
  type ProgressResponse,
} from '@steady/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  METRICS,
  METRIC_ORDER,
  compareMetric,
  directionText,
  progressHeadline,
} from '../metrics/metrics.js';
import { usePlayers } from '../players/usePlayers.js';
import { GroupDots } from '../progress/GroupDots.js';
import { MIN_POINTS, MetricChart } from '../progress/MetricChart.js';
import { AXIS_FORMAT, FLAG_SHORT } from '../progress/metrics.js';
import { sessionPoints, type SessionPoint } from '../progress/series.js';
import { SessionList } from '../progress/SessionList.js';
import { Skies } from '../progress/Skies.js';
import { WeekDots } from '../progress/WeekDots.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { ChipGroup } from '../ui/ChipGroup.js';
import styles from './Progress.module.css';

type State =
  | { k: 'loading' }
  | { k: 'error'; message: string }
  | { k: 'ready'; sessions: CompletedSession[]; progress: ProgressResponse; variant: Variant };

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const POINT_VALUE: Record<ProgressMetric, (p: SessionPoint) => number | null> = {
  commissionRate: (p) => p.catchRate,
  omissionRate: (p) => METRICS.omissionRate.show(p.omissionRate),
  medianGoRtMs: (p) => p.medianGoRtMs,
  rtCv: (p) => p.rtCv,
};

export const moreSessions = (n: number) => `${plural(n, 'more session')}`;

const PRE_PROBE_TITLE = 'Before each “where was your mind?”';

export function Progress() {
  const { api } = usePlayers();
  const [state, setState] = useState<State>({ k: 'loading' });
  const [metric, setMetric] = useState<ProgressMetric>('commissionRate');

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress(), api.getMe()])
      .then(
        ([sessions, progress, me]) =>
          !cancelled && setState({ k: 'ready', sessions, progress, variant: me.variant }),
      )
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
  const def = METRICS[metric];

  return (
    <section className={styles.progress}>
      <h1>Progress</h1>
      <p className={styles.lead} data-testid="summary">
        {progressHeadline(summary)}
      </p>

      {state.variant === 'game' && <Skies sessions={sessions} />}

      <Card as="section" aria-labelledby="week-title">
        <h2 id="week-title">Last 7 days</h2>
        <WeekDots completedAt={sessions.map((s) => s.completedAt)} />
      </Card>

      <Card as="section" aria-labelledby="recent-title">
        <h2 id="recent-title">Recent vs. where you started</h2>
        {summary.baseline && summary.recent ? (
          <RecentTable baseline={summary.baseline} recent={summary.recent} />
        ) : (
          <>
            <p>Your starting point is set after {moreSessions(summary.sessionsUntilBaseline)}.</p>
            <p className={styles.note}>
              Your first check is for getting used to the pace and does not count; checks 2–6 set
              where you started.
            </p>
          </>
        )}
      </Card>

      <section aria-labelledby="time-title" className={styles.block}>
        <h2 id="time-title">Over time</h2>
        <p className={styles.note}>Speed and accuracy side by side, one point per session.</p>
        {points.length >= MIN_POINTS && (
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
              First check (not counted)
            </li>
            {notedPoints(points).length > 0 && (
              <li>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M6 1L11 6L6 11L1 6Z" className={styles.keyFlagged} />
                </svg>
                Has a note (listed below the charts)
              </li>
            )}
            {summary.baseline && (
              <li>
                <svg viewBox="0 0 16 12" aria-hidden="true">
                  <line x1="0" y1="6" x2="16" y2="6" className={styles.keyBaseline} />
                </svg>
                Where you started
              </li>
            )}
          </ul>
        )}
        <div className={styles.charts}>
          {METRIC_ORDER.map((key) => {
            const b = summary.baseline?.[key].median ?? null;
            return (
              <MetricChart
                key={key}
                metric={key}
                points={points}
                value={POINT_VALUE[key]}
                baseline={b === null ? null : METRICS[key].show(b)}
              />
            );
          })}
        </div>
        <SessionNotes points={points} sessions={sessions} />
      </section>

      <section aria-labelledby="sessions-title" className={styles.block}>
        <h2 id="sessions-title">Your sessions</h2>
        <p className={styles.note}>Open a session to see its full results.</p>
        <SessionList sessions={sessions} />
      </section>

      <details className={styles.explore}>
        <summary>
          <h2>Exploring patterns</h2>
          <span className={styles.note}>
            How your check-in answers line up with your numbers. Exploratory: it describes, never
            explains.
          </span>
        </summary>

        <section aria-labelledby="checkin-title" className={styles.part}>
          <h3 id="checkin-title">After a check-in</h3>
          <p className={styles.note}>
            Each dot is one session, grouped by how you answered the check-in before it. Your first
            check is left out.
          </p>
          <ChipGroup<ProgressMetric>
            legend="Compare"
            name="compare"
            options={METRIC_ORDER.map((k) => ({ value: k, label: METRICS[k].name }))}
            value={metric}
            onChange={setMetric}
          />
          {(['sleep', 'stress'] as const).map((dimension) => (
            <GroupDots
              key={dimension}
              title={dimension === 'sleep' ? 'Sleep' : 'Stress'}
              comparison={progress.checkIn[dimension][metric]}
              labels={dimension === 'sleep' ? SLEEP : STRESS}
              show={def.show}
              axisFormat={AXIS_FORMAT[metric]}
              format={def.format}
              axisTitle={`${def.name} · ${directionText(metric)}`}
              unit="sessions"
              needMore={(n) => `Needs at least ${plural(n, 'more session')} with a check-in.`}
              sentence={(parts) =>
                `So far, “${def.name}” had a median of ${list(
                  parts.map((p) =>
                    dimension === 'sleep'
                      ? `${p.value} after ${IN_SENTENCE[p.key]} sleep`
                      : `${p.value} on ${IN_SENTENCE[p.key]} stress days`,
                  ),
                )}.`
              }
            />
          ))}
        </section>

        <div className={styles.part}>
          <GroupDots
            heading="h3"
            title={PRE_PROBE_TITLE}
            comparison={progress.preProbe}
            labels={ANSWERS}
            show={METRICS.rtCv.show}
            axisFormat={AXIS_FORMAT.rtCv}
            format={METRICS.rtCv.format}
            axisTitle={`${METRICS.rtCv.name} · ${directionText('rtCv')}`}
            unit="answers"
            needMore={(n) =>
              `Needs at least ${plural(
                Math.ceil(n / SART_CONFIG.probesPerSession),
                'more session',
              )}.`
            }
            sentence={(parts) =>
              `So far, how much your timing varied just before a question had a median of ${list(
                parts.map((p) => `${p.value} when you answered ${IN_SENTENCE[p.key]}`),
              )}.`
            }
          >
            <p className={styles.note}>
              Always the same measure, whatever you compare above: how much your timing varied over
              the {SART_CONFIG.preProbeWindow} digits just before each question, grouped by your
              answer. Lower means a more even rhythm.
            </p>
          </GroupDots>
        </div>
      </details>
    </section>
  );
}

/** The sessions drawn as a diamond: a flag, outside the first (not counted) session. */
const notedPoints = (points: SessionPoint[]) =>
  points.filter((p) => p.flags.length > 0 && !p.practice);

/**
 * The sessions drawn as a diamond, with their notes in words and a link to their Results,
 * so the notes are readable without hovering a point (a phone has no hover).
 */
function SessionNotes({
  points,
  sessions,
}: {
  points: SessionPoint[];
  sessions: CompletedSession[];
}) {
  const noted = notedPoints(points);
  if (points.length < MIN_POINTS || noted.length === 0) return null;
  return (
    <section aria-labelledby="notes-title" className={styles.notes}>
      <h3 id="notes-title">Sessions with a note</h3>
      <ul>
        {noted.map((p) => (
          <li key={p.session}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1L11 6L6 11L1 6Z" className={styles.keyFlagged} />
            </svg>
            <Link to={`/results/${sessions[p.session - 1]!.id}`}>Session {p.session}</Link>
            <span>{p.flags.map((f) => FLAG_SHORT[f]).join(', ')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const VERDICT_WORD = { better: ' · better', worse: ' · below' } as const;

/** Baseline and recent medians per metric, with the change in an arrow and words (Spec 004). */
function RecentTable({ baseline, recent }: { baseline: MetricSet; recent: MetricSet }) {
  const { baselineSessions, recentSessions, practiceSessions } = PROGRESS_CONFIG;
  const first = practiceSessions + 1;
  const fewer = METRIC_ORDER.flatMap((k) =>
    (
      [
        ['where you started', baseline[k].n, baselineSessions],
        ['recent', recent[k].n, recentSessions],
      ] as const
    )
      .filter(([, n, full]) => n < full)
      .map(
        ([which, n]) =>
          `${METRICS[k].name}, ${which}: ${plural(n, 'session')} (the others had too few presses).`,
      ),
  );

  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Where you started</th>
            <th scope="col">Recent</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_ORDER.map((k) => {
            const m = METRICS[k];
            const cell = (s: { median: number | null; n: number }, area: string) => (
              <td className={styles[area]} title={`Median of ${plural(s.n, 'session')}`}>
                <span className={styles.number}>
                  {s.median === null ? '–' : m.format(m.show(s.median))}
                </span>
              </td>
            );
            const change = compareMetric(k, recent[k].median, baseline[k].median);
            return (
              <tr key={k}>
                <th scope="row" className={styles.name}>
                  {m.name}
                  <span className={styles.rowHint}>{directionText(k)}</span>
                </th>
                {cell(baseline[k], 'started')}
                {cell(recent[k], 'recent')}
                <td className={styles.change}>
                  {change ? (
                    <span
                      className={styles.verdict}
                      data-testid="change"
                      data-verdict={change.verdict}
                    >
                      <span aria-hidden="true">{change.arrow} </span>
                      {change.words}
                      {(change.verdict === 'better' || change.verdict === 'worse') && (
                        <span className={styles.verdictWord}>{VERDICT_WORD[change.verdict]}</span>
                      )}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.footnote}>
        {[
          `Where you started: the middle of sessions ${first}–${first + baselineSessions - 1}.`,
          `Recent: the middle of your last ${recentSessions} checks.`,
          ...fewer,
        ].join(' ')}
      </p>
    </>
  );
}
