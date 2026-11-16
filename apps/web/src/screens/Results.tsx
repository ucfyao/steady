import {
  SART_CONFIG,
  type BehaviourFlag,
  type CompletedSession,
  type ProgressMetric,
  type ProgressSummary,
} from '@steady/core';
import { useEffect, useState } from 'react';
import {
  METRICS,
  chooseReference,
  compareMetric,
  headline,
  referenceName,
  type Comparison,
  type Reference,
} from '../metrics/metrics.js';
import { Link, useLocation, useParams } from 'react-router';
import { usePlayers } from '../players/usePlayers.js';
import { JourneyRibbon } from '../results/JourneyRibbon.js';
import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';
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
  | { k: 'error'; message: string };

const GO_TRIALS =
  SART_CONFIG.digits.length * SART_CONFIG.copiesPerDigit - SART_CONFIG.copiesPerDigit;

export function Results() {
  const { id } = useParams();
  const { api } = usePlayers();
  const passed = (useLocation().state as { session?: CompletedSession } | null)?.session;
  const [history, setHistory] = useState<History>({ k: 'loading' });

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getProgress()])
      .then(([sessions, progress]) => {
        if (!cancelled) setHistory({ k: 'ready', sessions, summary: progress.summary });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setHistory({ k: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const session =
    passed?.id === id && passed
      ? passed
      : history.k === 'ready'
        ? history.sessions.find((s) => s.id === id)
        : undefined;

  if (!session) {
    if (history.k === 'loading') return <p>Loading…</p>;
    if (history.k === 'error')
      return (
        <div role="alert" className="error">
          <p>{history.message}</p>
          <Link to="/">Back to home</Link>
        </div>
      );
    return (
      <StatusPage
        title="Session not found"
        primary={{ label: 'Back to home', to: '/' }}
        secondary={{ label: 'See your progress', to: '/progress' }}
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

  return (
    <section className={styles.results}>
      <h1>Session complete</h1>
      <p className={styles.lead} data-testid="conclusion" aria-live="polite">
        {reference ? headline(reference, comparisons) : '\u00a0'}
      </p>

      <Card as="section" aria-labelledby="stats-title">
        <h2 id="stats-title">This session</h2>
        <div className={styles.stats}>
          <Stat
            label={m.commissionRate.name}
            term={m.commissionRate.term}
            value={m.commissionRate.format(m.commissionRate.show(score.commissionRate))}
            note={threes > 0 ? `${caught} of ${threes}` : undefined}
            change={compare('commissionRate')}
            formatRef={m.commissionRate.format}
          />
          <Stat
            label={m.omissionRate.name}
            term={m.omissionRate.term}
            value={String(score.omissions)}
            change={compare('omissionRate')}
            formatRef={(r) => String(Math.round(r * GO_TRIALS))}
          />
          <Stat
            label={m.medianGoRtMs.name}
            term={m.medianGoRtMs.term}
            value={score.medianGoRtMs === null ? NOT_ENOUGH : `${Math.round(score.medianGoRtMs)}`}
            unit={score.medianGoRtMs === null ? undefined : 'ms'}
            change={compare('medianGoRtMs')}
            formatRef={m.medianGoRtMs.format}
          />
          <Stat
            label={m.rtCv.name}
            term={m.rtCv.term}
            value={score.rtCv === null ? NOT_ENOUGH : m.rtCv.format(score.rtCv)}
            change={compare('rtCv')}
            formatRef={m.rtCv.format}
          />
          <Stat
            label="Longest steady run"
            term="Presses in a row without a slip"
            value={String(score.longestSteadyRun)}
            unit="trials"
          />
        </div>
        {reference && reference.kind !== 'none' && comparisons.length > 0 && (
          <p className={styles.footnote}>
            Arrows show this session compared with {referenceName(reference)}
            {reference.kind === 'baseline'
              ? ' (the middle of sessions 2–6)'
              : ' (the middle value; your first check was practice)'}
            . One session up or down is normal.
          </p>
        )}
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
          See your progress
        </Button>
      </div>
    </section>
  );
}

/** A big serif number over a plain label, its change against the reference, and the term. */
function Stat({
  label,
  value,
  unit,
  note,
  term,
  change,
  formatRef,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  term: string;
  change?: Comparison | null;
  formatRef?: (shown: number) => string;
}) {
  const measured = value !== NOT_ENOUGH;
  return (
    <div className={styles.stat} role="group" aria-label={label}>
      <span className={measured ? styles.value : styles.notMeasured}>
        {value}
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
      {note && <span className={styles.note}>{note}</span>}
      <span className={styles.label}>{label}</span>
      {change && (
        <span className={styles.change} data-testid="change" data-verdict={change.verdict}>
          <span aria-hidden="true">{change.arrow} </span>
          {change.words}
          {formatRef && <span className={styles.ref}> · {formatRef(change.reference)} before</span>}
        </span>
      )}
      <span className={styles.term}>{term}</span>
    </div>
  );
}
