import type { CompletedSession, ProgressSummary } from '@steady/core';
import { useEffect, useState } from 'react';
import { usePlayers } from '../players/usePlayers.js';
import { lastCheckDay } from '../progress/lastCheck.js';
import { metricView } from '../progress/metrics.js';
import { WeekDots } from '../progress/WeekDots.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import styles from './Home.module.css';
import { moreSessions } from './Progress.js';

const catchRate = metricView('commissionRate');

/**
 * One number with a small label under it, read as "Catch rate, 75%". With no value, a dash
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

function LastCheck({ session }: { session: CompletedSession | undefined }) {
  if (!session)
    return (
      <Card as="section" aria-labelledby="last-title">
        <h2 id="last-title">Last check</h2>
        <p className={styles.empty}>No checks yet. Your first one starts with a short practice.</p>
      </Card>
    );
  const { score } = session;
  return (
    <Card as="section" aria-labelledby="last-title">
      <h2 id="last-title">Last check · {lastCheckDay(session.completedAt, new Date())}</h2>
      <div className={styles.stats}>
        <Stat label="Catch rate" value={catchRate.format(catchRate.show(score.commissionRate))} />
        <Stat label="Longest steady run" value={String(score.longestSteadyRun)} />
        {score.medianGoRtMs === null ? (
          <Stat label="Median response" value="—" note="Not enough data" />
        ) : (
          <Stat label="Median response" value={String(Math.round(score.medianGoRtMs))} unit="ms" />
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
      <p className={styles.lead}>Three minutes. Catch every digit, hold back on 3.</p>
      {data && (
        <>
          <Card as="section" aria-labelledby="week-title">
            <h2 id="week-title">Last 7 days</h2>
            <WeekDots completedAt={data.sessions.map((s) => s.completedAt)} />
          </Card>
          <LastCheck session={data.sessions.at(-1)} />
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
