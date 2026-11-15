import type { BehaviourFlag, CompletedSession } from '@steady/core';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { usePlayers } from '../players/usePlayers.js';
import { JourneyRibbon } from '../results/JourneyRibbon.js';
import { Button } from '../ui/Button.js';

/** Descriptive flags in plain words (Spec 004): about the session, never a failure. */
const FLAG_TEXT: Record<BehaviourFlag, string> = {
  high_omissions:
    'You let many digits pass without pressing. If something interrupted you, this session may not reflect your focus.',
  many_anticipations: 'Many presses came very early, before a digit could really be seen.',
  regular_timing:
    'Your timing was unusually even, which is more typical of automated input than of people.',
};

const NOT_ENOUGH = 'Not enough presses to measure';

type State =
  | { k: 'loading' }
  | { k: 'found'; session: CompletedSession }
  | { k: 'missing' }
  | { k: 'error'; message: string };

export function Results() {
  const { id } = useParams();
  const { api } = usePlayers();
  const passed = (useLocation().state as { session?: CompletedSession } | null)?.session;
  const [state, setState] = useState<State>(
    passed?.id === id && passed ? { k: 'found', session: passed } : { k: 'loading' },
  );

  useEffect(() => {
    if (state.k !== 'loading' || !api) return;
    let cancelled = false;
    api
      .listSessions()
      .then((sessions) => {
        if (cancelled) return;
        const session = sessions.find((s) => s.id === id);
        setState(session ? { k: 'found', session } : { k: 'missing' });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ k: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, id, state.k]);

  if (state.k === 'loading') return <p>Loading…</p>;
  if (state.k === 'error')
    return (
      <div role="alert" className="error">
        <p>{state.message}</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  if (state.k === 'missing')
    return (
      <section>
        <h1>Session not found</h1>
        <p>This session does not belong to the current player, or it no longer exists.</p>
        <Link to="/">Back to home</Link>
      </section>
    );

  const { score } = state.session;
  const count = (o: string) => score.trialOutcomes.filter((x) => x === o).length;
  const caught = count('caught');
  const threes = caught + count('commission');
  const summary =
    `Session journey: ${score.trialOutcomes.length} trials. ` +
    `${caught} of ${threes} 3s caught, ${count('omission')} digits missed, ` +
    `${count('anticipation')} presses too early. Longest steady run: ${score.longestSteadyRun} trials.`;
  const percent = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <section className="results">
      <h1>Session complete</h1>
      <p className="lead">
        You caught {caught} of {threes} 3s.
      </p>

      <JourneyRibbon
        outcomes={score.trialOutcomes}
        probes={score.probes}
        longestSteadyRun={score.longestSteadyRun}
        summary={summary}
      />

      <div className="tiles">
        <Tile
          label="Catch rate"
          value={percent(1 - score.commissionRate)}
          hint="3s you held back on"
        />
        <Tile
          label="Median response"
          value={score.medianGoRtMs === null ? NOT_ENOUGH : `${Math.round(score.medianGoRtMs)} ms`}
        />
        <Tile
          label="Rhythm variability"
          value={score.rtCv === null ? NOT_ENOUGH : percent(score.rtCv)}
          hint="Lower is steadier"
        />
        <Tile label="Missed digits" value={String(score.omissions)} />
        <Tile label="Longest steady run" value={`${score.longestSteadyRun} trials`} />
      </div>

      {score.flags.length > 0 && (
        <aside className="notice about">
          <h2>About this session</h2>
          <ul>
            {score.flags.map((f) => (
              <li key={f}>{FLAG_TEXT[f]}</li>
            ))}
          </ul>
        </aside>
      )}

      <div className="actions">
        <Button to="/play">Play again</Button>
        <Link to="/">Back to home</Link>
      </div>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile" role="group" aria-label={label}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}
