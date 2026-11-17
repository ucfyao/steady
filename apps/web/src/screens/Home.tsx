import type { CompletedSession, ProgressSummary, Variant } from '@steady/core';
import { useEffect, useState } from 'react';
import { dawnPercent, personalBest } from '../game/dawn.js';
import { Scene } from '../game/Scene.js';
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

/**
 * For a player with no checks yet: what Steady is, before anything about history (Spec 005).
 * No panel (Spec 014 §3): a sentence and three points, without repeating the hero's lead.
 */
function Welcome() {
  return (
    <section aria-labelledby="welcome-title" className={styles.welcome}>
      <h2 id="welcome-title" className="visually-hidden">
        What Steady does
      </h2>
      <p className={styles.welcomeLead}>
        A short game that shows how steady your attention is today.
      </p>
      <ul className={styles.welcomePoints}>
        <li>Starts with a 30-second practice</li>
        <li>Compared only with your own results</li>
        <li>Best a few times a week</li>
      </ul>
    </section>
  );
}

function LastCheck({ session, best }: { session: CompletedSession; best: number | null }) {
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
        {best !== null && <Stat label="Personal best" value={`dawn ${best}%`} />}
      </div>
    </Card>
  );
}

export function Home() {
  const { api, active } = usePlayers();
  const [data, setData] = useState<{
    sessions: CompletedSession[];
    summary: ProgressSummary;
    variant: Variant;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by "Try again" to load the history once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress(), api.getMe()])
      .then(([sessions, progress, me]) => {
        if (cancelled) return;
        setData({ sessions, summary: progress.summary, variant: me.variant });
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const game = data?.variant === 'game';
  const lastGame = game ? data.sessions.filter((s) => s.variant === 'game').at(-1) : undefined;
  const lastSky = lastGame ? dawnPercent(lastGame.score) : null;
  const best = game ? personalBest(data.sessions) : null;

  return (
    <section className={styles.home}>
      {/* The lantern's scene (Spec 007 §1); a game player sees the last sky they reached. */}
      {/* `--dawn` on the hero too, so the wash behind the text grows only as the sky lightens. */}
      <section
        aria-label="Today's check"
        className={styles.hero}
        ref={(el) => el?.style.setProperty('--dawn', ((lastSky ?? 0) / 100).toFixed(3))}
      >
        <Scene
          rich
          ref={(el) => el?.style.setProperty('--dawn', ((lastSky ?? 0) / 100).toFixed(3))}
        />
        <div className={styles.heroInner}>
          {/* A lit paper lantern on a cord, drawn in CSS (Spec 014 §2). */}
          <span className={styles.heroLantern} aria-hidden="true" data-testid="hero-lantern">
            <span className={styles.cord} />
            <span className={styles.lanternCap} />
            <span className={styles.lanternGlass} />
            <span className={styles.lanternBase} />
          </span>
          <div className={styles.heroText}>
            <h1 id="hero-title">Hi, {active?.name}</h1>
            {/* "on 3." stays together, so the 3 never wraps onto a line of its own. */}
            <p className={styles.lead}>Two minutes. Catch every digit, hold back on&nbsp;3.</p>
            {lastSky !== null && <p className={styles.sky}>Last sky: dawn {lastSky}%</p>}
            <Button to="/play" size="lg" className={styles.start}>
              Start today&apos;s check
            </Button>
          </div>
        </div>
      </section>
      {failed && (
        <div role="alert" className="error">
          <p>Could not load your history.</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
      {/* Keeps the space of the panels while the history loads, so nothing jumps (Spec 010). */}
      {!data && !failed && (
        <div
          role="status"
          aria-label="Loading your history"
          aria-busy="true"
          className={styles.reserved}
        />
      )}
      {data && data.sessions.length === 0 && <Welcome />}
      {data && data.sessions.length > 0 && (
        <>
          <Card as="section" aria-labelledby="week-title">
            <h2 id="week-title">Last 7 days</h2>
            <WeekDots completedAt={data.sessions.map((s) => s.completedAt)} />
          </Card>
          <LastCheck session={data.sessions.at(-1)!} best={best} />
          {data.summary.sessionsUntilBaseline > 0 && (
            <p className={styles.baseline}>
              {moreSessions(data.summary.sessionsUntilBaseline)} until your starting point
            </p>
          )}
        </>
      )}
    </section>
  );
}
