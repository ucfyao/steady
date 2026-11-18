import {
  type BehaviourFlag,
  type CompletedSession,
  type ProgressMetric,
  type ProgressSummary,
} from '@steady/core';
import { useEffect, useState } from 'react';
import {
  METRICS,
  METRIC_ORDER,
  chooseReference,
  compareMetric,
  headline,
  referenceName,
  type Comparison,
  type Reference,
} from '../metrics/metrics.js';
import { useLocation, useParams } from 'react-router';
import { errorWords } from '../api/client.js';
import { dawnPercent, personalBest, sessionPoints } from '../game/dawn.js';
import { Scene } from '../game/Scene.js';
import { useOverHero } from '../Layout.js';
import { usePlayers } from '../players/usePlayers.js';
import { JourneyRibbon } from '../results/JourneyRibbon.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
import { Loading } from '../ui/Loading.js';
import { StatusPage } from '../ui/StatusPage.js';
import styles from './Results.module.css';

/** Descriptive flags in plain words (Spec 004): about the session, never a failure. */
const FLAG_TEXT: Record<BehaviourFlag, string> = {
  high_omissions:
    'You let many digits pass without pressing. If something interrupted you, this session may not reflect your focus.',
  many_anticipations: 'Many presses came very early, before a digit could really be seen.',
  regular_timing:
    'Your timing was unusually even, which is more typical of automated input than of people.',
};

const NOT_ENOUGH = 'Not enough presses to measure';

/** The player's history and progress, for the comparisons. */
type History =
  | { k: 'loading' }
  | { k: 'ready'; sessions: CompletedSession[]; summary: ProgressSummary }
  | { k: 'error'; error: unknown };

export function Results() {
  const { id } = useParams();
  const { api, active } = usePlayers();
  // Play hands the new session over for an instant page. It belongs to the player who played
  // it: after a switch (same URL, same state) only the current player's history counts.
  const state = useLocation().state as { session?: CompletedSession; playerId?: string } | null;
  const passed = state?.playerId === active?.id ? state?.session : undefined;
  const [history, setHistory] = useState<History>({ k: 'loading' });
  // Bumped by "Try again" to load the history once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress()])
      .then(([sessions, progress]) => {
        if (!cancelled) setHistory({ k: 'ready', sessions, summary: progress.summary });
      })
      .catch((error: unknown) => {
        if (!cancelled) setHistory({ k: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const session =
    passed?.id === id && passed
      ? passed
      : history.k === 'ready'
        ? history.sessions.find((s) => s.id === id)
        : undefined;
  // Spec 018: once a session is shown, the header lies on its sky.
  useOverHero(session !== undefined);

  if (!session) {
    if (history.k === 'loading') return <Loading label="Loading your results…" />;
    if (history.k === 'error')
      return (
        <StatusPage
          title="Could not load this session"
          alert
          primary={{
            label: 'Try again',
            onClick: () => {
              setHistory({ k: 'loading' });
              setAttempt((n) => n + 1);
            },
          }}
          secondary={{ label: 'Back to home', to: '/' }}
        >
          {errorWords(history.error)}
        </StatusPage>
      );
    return (
      <StatusPage
        title="Session not found"
        primary={{ label: 'Back to home', to: '/' }}
        secondary={{ label: 'See your trends', to: '/progress' }}
      >
        This session does not belong to the current player, or it no longer exists.
      </StatusPage>
    );
  }

  // Comparisons need the history; until it arrives (or if it fails) the page shows none.
  const reference: Reference | null =
    history.k === 'ready' && history.sessions.some((s) => s.id === session.id)
      ? chooseReference(session.id, history.sessions, history.summary)
      : null;
  const compare = (key: ProgressMetric): Comparison | null =>
    reference && reference.kind !== 'none'
      ? compareMetric(key, session.score[key], reference.values[key])
      : null;
  const comparisons = (Object.keys(METRICS) as ProgressMetric[])
    .map(compare)
    .filter((c): c is Comparison => c !== null);

  const { score } = session;
  const count = (o: string) => score.trialOutcomes.filter((x) => x === o).length;
  const caught = count('caught');
  const threes = caught + count('commission');
  const summary =
    `Session journey: ${score.trialOutcomes.length} trials. ` +
    `${caught} of ${threes} 3s held back, ${count('omission')} digits missed, ` +
    `${count('anticipation')} presses too early. Longest steady run: ${score.longestSteadyRun} trials.`;
  const m = METRICS;
  // The sky this session reached (Spec 018): its dawn for a game session, the night otherwise.
  const dawn = (session.variant === 'game' ? dawnPercent(score) / 100 : 0).toFixed(3);

  return (
    <section className={styles.results}>
      {/* `--dawn` on the band too, so the wash behind the text grows only as the sky lightens. */}
      <section
        aria-label="Your sky"
        className={styles.sky}
        ref={(el) => el?.style.setProperty('--dawn', dawn)}
      >
        <Scene rich ref={(el) => el?.style.setProperty('--dawn', dawn)} />
        <div className={styles.skyInner}>
          {/* The name is for screen readers; the conclusion is the first visible line (Spec 010). */}
          <h1 className="visually-hidden">Session complete</h1>
          <p
            className={`headline ${styles.conclusion}`}
            data-testid="conclusion"
            aria-live="polite"
          >
            {reference ? headline(reference, comparisons) : 'Session complete.'}
          </p>

          {session.variant === 'game' && (
            <GameSummary
              session={session}
              earlier={
                history.k === 'ready'
                  ? history.sessions.filter((s) => s.completedAt < session.completedAt)
                  : null
              }
            />
          )}
        </div>
      </section>

      <Card as="section" aria-labelledby="stats-title">
        <h2 id="stats-title">This session</h2>
        <div className={styles.stats}>
          <Stat
            label={m.commissionRate.name}
            value={m.commissionRate.format(m.commissionRate.show(score.commissionRate))}
            note={threes > 0 ? `${caught} of ${threes}` : undefined}
            change={compare('commissionRate')}
            formatRef={m.commissionRate.format}
          />
          <Stat
            label={m.omissionRate.name}
            value={m.omissionRate.format(m.omissionRate.show(score.omissionRate))}
            change={compare('omissionRate')}
            formatRef={m.omissionRate.format}
          />
          <Stat
            label={m.medianGoRtMs.name}
            value={score.medianGoRtMs === null ? NOT_ENOUGH : `${Math.round(score.medianGoRtMs)}`}
            unit={score.medianGoRtMs === null ? undefined : 'ms'}
            change={compare('medianGoRtMs')}
            formatRef={m.medianGoRtMs.format}
          />
          <Stat
            label={m.rtCv.name}
            value={score.rtCv === null ? NOT_ENOUGH : m.rtCv.format(score.rtCv)}
            change={compare('rtCv')}
            formatRef={m.rtCv.format}
          />
          <Stat label={STEADY_RUN.name} value={String(score.longestSteadyRun)} unit="trials" />
        </div>
        {reference && reference.kind !== 'none' && comparisons.length > 0 && (
          <p className={styles.footnote}>
            Arrows show this session compared with {referenceName(reference)}
            {reference.kind === 'baseline'
              ? ' (the middle of sessions 2–6)'
              : ' (the middle value; your first check does not count)'}
            . One session up or down is normal.
          </p>
        )}
        <AboutMeasures />
      </Card>

      <Card as="section" aria-labelledby="journey-title">
        <h2 id="journey-title">Your session, from start to end</h2>
        <JourneyRibbon
          outcomes={score.trialOutcomes}
          probes={score.probes}
          longestSteadyRun={score.longestSteadyRun}
          summary={summary}
        />
      </Card>

      {score.flags.length > 0 && (
        <Card as="aside" aria-labelledby="about-title" className={styles.about}>
          <h2 id="about-title">About this session</h2>
          <ul>
            {score.flags.map((f) => (
              <li key={f}>{FLAG_TEXT[f]}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className={styles.actions}>
        <Button to="/" size="lg">
          Back to home
        </Button>
        <Button to="/progress" variant="secondary" size="lg">
          See your trends
        </Button>
      </div>
    </section>
  );
}

/**
 * The game first (Spec 006 §4), on the session's sky (Spec 018): the points of the server's outcomes, the longest streak and how far the
 * sky got towards dawn (points ÷ an all-correct session's points, rounded down).
 */
function GameSummary({
  session,
  earlier,
}: {
  session: CompletedSession;
  /** Sessions completed before this one, once the history has loaded. */
  earlier: CompletedSession[] | null;
}) {
  const { score } = session;
  // Points are never stored: they are always the points of the server's trial outcomes.
  const points = sessionPoints(score);
  const dawn = dawnPercent(score);
  // Spec 007 §2: a higher dawn than every earlier game session, and there was one.
  const before = earlier ? personalBest(earlier) : null;
  const newBest = before !== null && dawn > before;
  return (
    <section aria-labelledby="game-title" className={styles.game}>
      <h2 id="game-title">Your game</h2>
      {newBest && <p className={styles.newBest}>New personal best</p>}
      <p className={styles.gamePoints}>
        <b>{points}</b> points
      </p>
      <p className={styles.gameLine}>
        Longest streak: {score.longestSteadyRun} · Dawn {dawn}%
      </p>
    </section>
  );
}

const STEADY_RUN = {
  name: 'Longest steady run',
  description:
    'The most digits in a row without a slip: no press on a 3, no missed digit, no early press.',
};

/**
 * The research terms and a sentence for each number, out of the tiles (Spec 004). A native
 * disclosure, so it opens by click, tap or keyboard, with no hover needed.
 */
function AboutMeasures() {
  const items = [
    ...METRIC_ORDER.map((k) => ({
      name: METRICS[k].name,
      description: METRICS[k].description,
      term: METRICS[k].term,
    })),
    { ...STEADY_RUN, term: null },
  ];
  return (
    <details className={styles.measures}>
      <summary>About these measures</summary>
      <dl>
        {items.map((i) => (
          <div key={i.name}>
            <dt>{i.name}</dt>
            <dd>
              {i.description}
              {i.term && <span className={styles.term}> Research term: {i.term}.</span>}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** A big serif number (with its count on the same line), a plain label and its change. */
function Stat({
  label,
  value,
  unit,
  note,
  change,
  formatRef,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  change?: Comparison | null;
  formatRef?: (shown: number) => string;
}) {
  const measured = value !== NOT_ENOUGH;
  return (
    <div className={styles.stat} role="group" aria-label={label}>
      <span className={styles.line} data-testid="value">
        <span className={measured ? styles.value : styles.notMeasured}>
          {value}
          {unit && <span className={styles.unit}> {unit}</span>}
        </span>
        {note && <span className={styles.note}> {note}</span>}
      </span>
      <span className={styles.label}>{label}</span>
      {change && (
        <span className={styles.change} data-testid="change" data-verdict={change.verdict}>
          <span aria-hidden="true">{change.arrow} </span>
          {change.words}
          {formatRef && <span className={styles.ref}> · {formatRef(change.reference)} before</span>}
        </span>
      )}
    </div>
  );
}
