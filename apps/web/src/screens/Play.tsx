import {
  SLEEP_LEVELS,
  STRESS_LEVELS,
  type CheckIn,
  type StartedSession,
  type Submission,
  type Variant,
} from '@steady/core';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { Block } from '../game/Block.js';
import { HowToPlay } from '../game/HowToPlay.js';
import { PracticeLine } from '../game/PracticeLine.js';
import { Steps } from '../game/Steps.js';
import { browserEnv, type PlayEnv } from '../game/env.js';
import { createPracticePlan, summarisePractice, type PracticeSummary } from '../game/practice.js';
import type { RunnerOptions } from '../game/runner.js';
import { usePlayers } from '../players/usePlayers.js';
import { Button } from '../ui/Button.js';
import { ChipGroup } from '../ui/ChipGroup.js';
import { Loading } from '../ui/Loading.js';
import { StatusPage } from '../ui/StatusPage.js';
import styles from './Play.module.css';

const PRACTICE_OPTIONS: RunnerOptions = { feedbackMs: 800 }; // [P] Spec 004
const MAIN_OPTIONS: RunnerOptions = {};

/**
 * First time: intro (step 1) → practice → before you start (step 2, with how the practice
 * went) → countdown and trials. Returning players start at "before you start", which links
 * back to the intro (Spec 005).
 */
type Step =
  | { k: 'loading' }
  | { k: 'intro' }
  | { k: 'practice'; plan: ReturnType<typeof createPracticePlan> }
  | { k: 'before' }
  | { k: 'starting' }
  | { k: 'running'; session: StartedSession }
  | { k: 'submitting'; session: StartedSession; submission: Submission }
  | { k: 'submit-error'; session: StartedSession; submission: Submission; error: ApiError }
  | { k: 'voided'; during: 'practice' | 'session' }
  | { k: 'error'; message: string };

const LABELS: Record<string, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** The chip group's value while nothing is chosen. */
const NONE = '';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Play({ env: injected }: { env?: PlayEnv }) {
  const { api } = usePlayers();
  const navigate = useNavigate();
  const [env] = useState(() => injected ?? browserEnv());
  const [step, setStep] = useState<Step>({ k: 'loading' });
  const [firstTime, setFirstTime] = useState(false);
  /** On the step-by-step path (first time, or after "How to play"): show the step bar. */
  const [guided, setGuided] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn>({});
  /** The last practice's counts, shown on "Before you start" while on the guided path. */
  const [practiced, setPracticed] = useState<PracticeSummary | null>(null);
  /** The A/B variant for practice (Spec 006); the real session uses what the server says. */
  const [variant, setVariant] = useState<Variant>('calm');

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    Promise.all([api.listSessions(), api.getMe()])
      .then(([sessions, me]) => {
        if (cancelled) return;
        setVariant(env.variantOverride ?? me.variant);
        const first = sessions.length === 0;
        setFirstTime(first);
        setGuided(first);
        setStep(first ? { k: 'intro' } : { k: 'before' });
      })
      .catch((e: unknown) => !cancelled && setStep({ k: 'error', message: message(e) }));
    return () => {
      cancelled = true;
    };
  }, [api, env]);

  const intro = () => {
    setGuided(true);
    setPracticed(null);
    setStep({ k: 'intro' });
  };
  const practice = () => setStep({ k: 'practice', plan: createPracticePlan(Date.now()) });

  async function start(answers: CheckIn = checkIn) {
    if (!api) return;
    setStep({ k: 'starting' });
    try {
      const hasCheckIn = answers.sleep !== undefined || answers.stress !== undefined;
      const session = await api.startSession({
        checkIn: hasCheckIn ? answers : null,
        device: env.device,
        ...(env.variantOverride && { variant: env.variantOverride }),
      });
      setStep({ k: 'running', session });
    } catch (e) {
      setStep({ k: 'error', message: message(e) });
    }
  }

  async function submit(session: StartedSession, submission: Submission) {
    if (!api) return;
    setStep({ k: 'submitting', session, submission });
    try {
      const completed = await api.submitSession(session.id, submission);
      navigate(`/results/${completed.id}`, { state: { session: completed } });
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError('server', message(e));
      setStep({ k: 'submit-error', session, submission, error });
    }
  }

  // The one line shown under the digit in focus mode.
  const rule =
    env.device === 'touch' ? 'Tap for every digit except 3' : 'Space for every digit except 3';

  switch (step.k) {
    case 'loading':
      return <Loading label="Loading…" />;
    case 'starting':
      return <Loading label="Starting your session…" />;
    case 'submitting':
      return <Loading label="Scoring your session…" />;

    case 'intro':
      return (
        <section className={styles.screen}>
          <Steps step={1} label="How it works" />
          <h1>
            {'Catch every digit. '}
            <br />
            Hold back on 3.
          </h1>
          <p className={styles.lead}>Digits flash one at a time. React to each one, except 3.</p>
          <HowToPlay device={env.device} />
          <Button size="lg" onClick={practice}>
            Try a short practice
          </Button>
          <p className={styles.footnote}>12 digits · about 30 seconds · not saved</p>
          {!firstTime && (
            <Button
              variant="link"
              className={styles.centered}
              onClick={() => {
                setGuided(false);
                setStep({ k: 'before' });
              }}
            >
              Skip practice
            </Button>
          )}
        </section>
      );

    case 'practice':
      return (
        <Block
          plan={step.plan}
          options={PRACTICE_OPTIONS}
          hint={`Practice · ${rule}`}
          env={env}
          variant={variant}
          onDone={({ rts }) => {
            setPracticed(summarisePractice(step.plan.trials, rts));
            setStep({ k: 'before' });
          }}
          onVoid={() => setStep({ k: 'voided', during: 'practice' })}
        />
      );

    case 'before':
      return (
        <BeforeYouStart
          guided={guided}
          practice={
            guided && practiced ? (
              <PracticeLine summary={practiced} device={env.device} onAgain={practice} />
            ) : null
          }
          value={checkIn}
          onChange={setCheckIn}
          onStart={() => start()}
          onSkip={() => {
            setCheckIn({});
            start({});
          }}
          onHowToPlay={intro}
        />
      );

    case 'running':
      return (
        <Block
          plan={step.session.plan}
          options={MAIN_OPTIONS}
          hint={rule}
          env={env}
          variant={step.session.variant}
          onDone={(submission) => submit(step.session, submission)}
          onVoid={() => setStep({ k: 'voided', during: 'session' })}
        />
      );

    case 'submit-error': {
      const retryable = !['unprocessable', 'conflict'].includes(step.error.kind);
      return (
        <div role="alert" className="error">
          <p>{step.error.message}</p>
          {retryable ? (
            <Button onClick={() => submit(step.session, step.submission)}>Try again</Button>
          ) : (
            <Link to="/">Back to home</Link>
          )}
        </div>
      );
    }

    case 'voided':
      return (
        <StatusPage
          tone="warning"
          title={step.during === 'practice' ? 'Practice stopped' : 'Session voided'}
          primary={{
            label: 'Play again',
            // A first-time player who left the practice starts the steps again.
            onClick: () =>
              step.during === 'practice' && firstTime ? intro() : setStep({ k: 'before' }),
          }}
          secondary={{ label: 'Back to home', to: '/' }}
        >
          You left the page while it was running. Leaving the page interrupts the timing, so{' '}
          {step.during === 'practice' ? 'the practice stopped' : 'this session was not saved'}.
        </StatusPage>
      );

    case 'error':
      return (
        <div role="alert" className="error">
          <p>{step.message}</p>
          <Link to="/">Back to home</Link>
        </div>
      );
  }
}

/**
 * Step 2 (Spec 005), shared by new and returning players: how the practice went (after one),
 * the check-in and three points.
 */
function BeforeYouStart({
  guided,
  practice,
  value,
  onChange,
  onStart,
  onSkip,
  onHowToPlay,
}: {
  guided: boolean;
  practice: ReactNode;
  value: CheckIn;
  onChange(v: CheckIn): void;
  onStart(): void;
  onSkip(): void;
  onHowToPlay(): void;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart();
  };
  const group = <K extends keyof CheckIn>(
    field: K,
    legend: string,
    levels: readonly NonNullable<CheckIn[K]>[],
  ) => (
    <ChipGroup<string>
      legend={legend}
      name={field}
      options={levels.map((level) => ({ value: level, label: LABELS[level] }))}
      value={value[field] ?? NONE}
      onChange={(level) => onChange({ ...value, [field]: level })}
    />
  );

  return (
    <form onSubmit={submit} className={styles.screen}>
      {guided && <Steps step={2} label="Before you start" />}
      {practice}
      <h1>How are you today?</h1>
      <p className={styles.lead}>
        Optional. It helps you spot patterns later; it never changes your score.
      </p>
      <div className={styles.questions}>
        {group('sleep', 'Sleep', SLEEP_LEVELS)}
        {group('stress', 'Stress', STRESS_LEVELS)}
      </div>
      <ul className={styles.points} aria-label="Before you start">
        <li>
          <span className={styles.icon} aria-hidden="true">
            2′
          </span>
          About two minutes, at full speed
        </li>
        <li>
          <span className={styles.icon} aria-hidden="true">
            ?
          </span>
          A few times we ask where your mind was
        </li>
        <li className={styles.warn}>
          <span className={styles.icon} aria-hidden="true">
            !
          </span>
          Stay on this page: leaving cancels the session
        </li>
      </ul>
      <Button type="submit" size="lg">
        Start
      </Button>
      <div className={styles.links}>
        <Button variant="link" onClick={onSkip}>
          Skip
        </Button>
        <Button variant="link" onClick={onHowToPlay}>
          How to play
        </Button>
      </div>
    </form>
  );
}
