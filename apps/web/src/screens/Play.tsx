import {
  SLEEP_LEVELS,
  STRESS_LEVELS,
  type CheckIn,
  type StartedSession,
  type Submission,
} from '@steady/core';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../api/client.js';
import { Block } from '../game/Block.js';
import { HowToPlay } from '../game/HowToPlay.js';
import { browserEnv, type PlayEnv } from '../game/env.js';
import { createPracticePlan } from '../game/practice.js';
import type { RunnerOptions } from '../game/runner.js';
import { usePlayers } from '../players/usePlayers.js';
import { Button } from '../ui/Button.js';
import { ChipGroup } from '../ui/ChipGroup.js';

const PRACTICE_OPTIONS: RunnerOptions = { feedbackMs: 800 }; // [P] Spec 004
const MAIN_OPTIONS: RunnerOptions = {};

type Step =
  | { k: 'loading' }
  | { k: 'checkin' }
  | { k: 'practice-intro' }
  | { k: 'practice'; plan: ReturnType<typeof createPracticePlan> }
  | { k: 'ready'; practiced: boolean }
  | { k: 'starting' }
  | { k: 'running'; session: StartedSession }
  | { k: 'submitting'; session: StartedSession; submission: Submission }
  | { k: 'submit-error'; session: StartedSession; submission: Submission; error: ApiError }
  | { k: 'voided' }
  | { k: 'error'; message: string };

const LABELS: Record<string, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** The chip value for "no answer" (the field is left out of the check-in). */
const SKIP = '';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Play({ env: injected }: { env?: PlayEnv }) {
  const { api } = usePlayers();
  const navigate = useNavigate();
  const [env] = useState(() => injected ?? browserEnv());
  const [step, setStep] = useState<Step>({ k: 'loading' });
  const [firstTime, setFirstTime] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn>({});

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .listSessions()
      .then((sessions) => {
        if (cancelled) return;
        setFirstTime(sessions.length === 0);
        setStep({ k: 'checkin' });
      })
      .catch((e: unknown) => !cancelled && setStep({ k: 'error', message: message(e) }));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const practice = () => setStep({ k: 'practice', plan: createPracticePlan(Date.now()) });

  async function start() {
    if (!api) return;
    setStep({ k: 'starting' });
    try {
      const hasCheckIn = checkIn.sleep !== undefined || checkIn.stress !== undefined;
      const session = await api.startSession({
        checkIn: hasCheckIn ? checkIn : null,
        device: env.device,
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

  const reminder =
    env.device === 'touch'
      ? 'Tap the box for every digit except 3'
      : 'Press Space for every digit except 3';

  switch (step.k) {
    case 'loading':
    case 'starting':
    case 'submitting':
      return <p>{step.k === 'submitting' ? 'Saving your session…' : 'Loading…'}</p>;

    case 'checkin':
      return (
        <CheckInForm
          value={checkIn}
          onChange={setCheckIn}
          onContinue={() =>
            setStep(firstTime ? { k: 'practice-intro' } : { k: 'ready', practiced: false })
          }
        />
      );

    case 'practice-intro':
      return (
        <section>
          <h1>First, a short practice</h1>
          <HowToPlay device={env.device} />
          <p>
            18 digits. It starts slow and speeds up to the real pace, with feedback after each one.
            Nothing is saved.
          </p>
          <Button size="lg" onClick={practice}>
            Start practice
          </Button>
        </section>
      );

    case 'practice':
      return (
        <Block
          plan={step.plan}
          options={PRACTICE_OPTIONS}
          reminder={reminder}
          env={env}
          onDone={() => setStep({ k: 'ready', practiced: true })}
          onVoid={() => setStep({ k: 'voided' })}
        />
      );

    case 'ready':
      return (
        <section>
          {step.practiced && (
            <p className="notice">
              Practice complete. The real session runs at full speed the whole way.
            </p>
          )}
          <h1>Ready?</h1>
          <HowToPlay device={env.device} />
          <p>
            About three minutes. A few times you will be asked where your mind was. Stay on this
            page until the end: leaving it voids the session.
          </p>
          <div className="actions">
            <Button size="lg" onClick={start}>
              Start
            </Button>
            <Button variant="secondary" onClick={practice}>
              Practice again
            </Button>
          </div>
        </section>
      );

    case 'running':
      return (
        <Block
          plan={step.session.plan}
          options={MAIN_OPTIONS}
          env={env}
          onDone={(submission) => submit(step.session, submission)}
          onVoid={() => setStep({ k: 'voided' })}
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
        <section>
          <h1>Session voided</h1>
          <p>Leaving the page interrupts the timing, so this session was not saved.</p>
          <Link to="/">Back to home</Link>
        </section>
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

function CheckInForm({
  value,
  onChange,
  onContinue,
}: {
  value: CheckIn;
  onChange(v: CheckIn): void;
  onContinue(): void;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onContinue();
  };
  const group = <K extends keyof CheckIn>(
    field: K,
    legend: string,
    levels: readonly NonNullable<CheckIn[K]>[],
  ) => (
    <ChipGroup
      legend={legend}
      name={field}
      options={[
        ...levels.map((level) => ({ value: level as string, label: LABELS[level] })),
        { value: SKIP, label: 'Skip' },
      ]}
      value={value[field] ?? SKIP}
      onChange={(level) => {
        const next = { ...value };
        if (level === SKIP) delete next[field];
        else next[field] = level as NonNullable<CheckIn[K]>;
        onChange(next);
      }}
    />
  );

  return (
    <form onSubmit={submit}>
      <h1>How are you today?</h1>
      <p className="lead">
        Optional. It lets you compare your sessions later; it never changes your score.
      </p>
      {group('sleep', 'How did you sleep?', SLEEP_LEVELS)}
      {group('stress', 'How stressed do you feel?', STRESS_LEVELS)}
      <Button type="submit" size="lg">
        Continue
      </Button>
    </form>
  );
}
