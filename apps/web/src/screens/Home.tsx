import type { CompletedSession, ProgressSummary } from '@steady/core';
import { useEffect, useState } from 'react';
import { METRICS } from '../metrics/metrics.js';
import { usePlayers } from '../players/usePlayers.js';
import { lastCheckDay } from '../progress/lastCheck.js';
import { WeekDots } from '../progress/WeekDots.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import styles from './Home.module.css';
import { moreSessions } from './Progress.js';

const { commissionRate: catchRate, medianGoRtMs: response } = METRICS;

/**
 * One number with a small label under it, read as "3s held back, 75%". With no value, a dash
 * and a short note on its own line instead.
 */
function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div role="group" aria-label={label} className={styles.stat}>
      <span className={styles.value}>
        {value}
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
      {note && <span className={styles.note}>{note}</span>}
      <span className={styles.label}>{label}</span>
    </div>
  );
}

/** For a player with no checks yet: what Steady is, before anything about history (Spec 005). */
function Welcome() {
  return (
    <Card as="section" aria-labelledby="welcome-title">
      <h2 id="welcome-title">What Steady does</h2>
      <p className={styles.empty}>
        A short game that shows how steady your attention is today. Play a few times a week to see
        your own pattern.
      </p>
      <ul className={styles.points}>
        <li>About two minutes</li>
        <li>Starts with a 30-second practice</li>
        <li>Compared only with your own results</li>
      </ul>
    </Card>
  );
}

function LastCheck({ session }: { session: CompletedSession }) {
  const { score } = session;
  return (
    <Card as="section" aria-labelledby="last-title">
      <h2 id="last-title">Last check · {lastCheckDay(session.completedAt, new Date())}</h2>
      <div className={styles.stats}>
        <Stat
          label={catchRate.name}
          value={catchRate.format(catchRate.show(score.commissionRate))}
        />
        <Stat label="Longest steady run" value={String(score.longestSteadyRun)} />
        {score.medianGoRtMs === null ? (
          <Stat label={response.name} value="—" note="Not enough data" />
        ) : (
          <Stat label={response.name} value={String(Math.round(score.medianGoRtMs))} unit="ms" />
        )}
      </div>
    </Card>
  );
}

export function Home() {
  const { api, active } = usePlayers();
  const [data, setData] = useState<{
    sessions: CompletedSession[];
    summary: ProgressSummary;
  } | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress()])
      .then(
        ([sessions, progress]) => !cancelled && setData({ sessions, summary: progress.summary }),
      )
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section className={styles.home}>
      <h1>Hi, {active?.name}</h1>
      {/* "on 3." stays together, so the 3 never wraps onto a line of its own. */}
      <p className={styles.lead}>Two minutes. Catch every digit, hold back on&nbsp;3.</p>
      {data && data.sessions.length === 0 && <Welcome />}
      {data && data.sessions.length > 0 && (
        <>
          <Card as="section" aria-labelledby="week-title">
            <h2 id="week-title">Last 7 days</h2>
            <WeekDots completedAt={data.sessions.map((s) => s.completedAt)} />
          </Card>
          <LastCheck session={data.sessions.at(-1)!} />
          {data.summary.sessionsUntilBaseline > 0 && (
            <p className={styles.baseline}>
              {moreSessions(data.summary.sessionsUntilBaseline)} until your starting point
            </p>
          )}
        </>
      )}
      <Button to="/play" size="lg" className={styles.start}>
        Start today&apos;s check
      </Button>
    </section>
  );
}
