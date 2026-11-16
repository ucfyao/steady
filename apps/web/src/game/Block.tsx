import {
  maxPoints,
  pointsSoFar,
  trialOutcome,
  type ProbeAnswer,
  type Submission,
  type TrialOutcome,
  type Variant,
} from '@steady/core';
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { useFocusMode } from '../Layout.js';
import { Button } from '../ui/Button.js';
import styles from './Block.module.css';
import type { PlayEnv } from './env.js';
import { TrialRunner, type Outcome, type RunnerOptions, type RunnerPlan } from './runner.js';
import { Scene } from './Scene.js';

const COUNTDOWN_S = 3;
/** Spec 006: three words, one a second. No number, so no 3 appears before the trials. */
const COUNTDOWN_WORDS = ['Go', 'Set', 'Ready'] as const; // indexed by seconds left − 1
/** [R] PsyToolkit SART: five font sizes (48–120 pt), kept as ratios of the largest. */
const FONT_PX = [48, 72, 94, 100, 120] as const;
/**
 * The largest size is `--digit-max` (Block.module.css), sized to the lantern's glass.
 * Built once, so a frame only assigns a ready-made string, as before.
 */
const FONT_SIZE = FONT_PX.map((px) => `calc(var(--digit-max) * ${px / 120})`);
/** Spec 006: at most this many fireflies on screen. */
const MAX_FLIES = 30;

/** Practice feedback (Spec 004): one or two words in a coloured pill, readable in 800 ms. */
const FEEDBACK: Record<Outcome, { text: string; good: boolean }> = {
  hit: { text: '✓ Nice', good: true },
  caught: { text: 'Held back ✓', good: true },
  commission: { text: 'That was a 3', good: false },
  omission: { text: 'Missed', good: false },
  early: { text: 'Too soon', good: false },
};

const ANSWERS: { answer: ProbeAnswer; label: string; key: string }[] = [
  { answer: 'on_task', label: 'On task', key: '1' },
  { answer: 'drifting', label: 'Drifting', key: '2' },
  { answer: 'elsewhere', label: 'Elsewhere', key: '3' },
];

type Ui =
  | { kind: 'countdown'; n: number }
  | { kind: 'trials' }
  | { kind: 'feedback'; outcome: Outcome }
  | { kind: 'probe' }
  | { kind: 'resume' };

/**
 * One block of trials (practice or the real session) on the lantern scene (Spec 006).
 * The digit, the frost, the glow and the game layer are written straight into the DOM, so
 * the digit is on screen in the frame whose timestamp becomes its onset and React renders
 * only the countdown, feedback and probe.
 */
export function Block({
  plan,
  options,
  env,
  variant,
  onDone,
  onVoid,
  hint,
}: {
  plan: RunnerPlan;
  options?: RunnerOptions;
  /** The rule, in one quiet line under the lantern. */
  hint: string;
  env: PlayEnv;
  variant: Variant;
  onDone(submission: Submission): void;
  onVoid(): void;
}) {
  const stimulus = useRef<HTMLDivElement>(null);
  const frost = useRef<HTMLDivElement>(null);
  const lantern = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const flies = useRef<HTMLDivElement>(null);
  const pointsEl = useRef<HTMLSpanElement>(null);
  const multEl = useRef<HTMLSpanElement>(null);
  const runnerRef = useRef<TrialRunner | null>(null);
  /** Set by the effect: records a press and lights the lantern. */
  const pressRef = useRef<((time: number, repeat?: boolean) => void) | null>(null);
  const [ui, setUi] = useState<Ui>({ kind: 'countdown', n: COUNTDOWN_S });
  const focusRoot = useRef<HTMLDivElement>(null);
  const done = useEffectEvent(onDone);
  const game = variant === 'game';
  useFocusMode();

  // Focus moves into the block, off the button that started it (which is now gone).
  useEffect(() => focusRoot.current?.focus(), []);
  const voided = useEffectEvent(onVoid);

  useEffect(() => {
    const runner = new TrialRunner(plan, options);
    runnerRef.current = runner;
    let frameId = 0;
    let stopped = false;
    let firstFrame: number | null = null;
    let started = false;
    let shown = '';

    // ---- The game layer (Spec 006 §2) ----
    // One count: the points of the outcomes so far, by core's rules, recomputed whenever an
    // outcome is known. Results shows the points of the server's outcomes for the same
    // presses, so the two always agree. Nothing here is sent.
    const best = maxPoints(plan.trials);
    const outcomes: TrialOutcome[] = [];
    let current = -1;

    const scatter = () => {
      for (const f of flies.current?.querySelectorAll<HTMLElement>('[data-testid="firefly"]') ??
        []) {
        if (f.dataset.gone) continue;
        f.dataset.gone = 'true';
        f.classList.add(styles.gone!);
        setTimeout(() => f.remove(), 800);
      }
    };
    const addFly = () => {
      const box = flies.current;
      if (!box) return;
      const alive = box.querySelectorAll('[data-testid="firefly"]:not([data-gone])');
      if (alive.length >= MAX_FLIES) return;
      const f = document.createElement('i');
      f.dataset.testid = 'firefly';
      f.className = styles.fly!;
      f.style.left = `${8 + Math.random() * 84}%`;
      f.style.top = `${12 + Math.random() * 60}%`;
      f.style.setProperty('--dx', `${Math.round(Math.random() * 40 - 20)}px`);
      f.style.setProperty('--dy', `${Math.round(Math.random() * 40 - 20)}px`);
      box.appendChild(f);
    };
    const float = (gained: number) => {
      const box = flies.current;
      if (!box) return;
      const f = document.createElement('span');
      f.className = styles.float!;
      f.textContent = `+${gained}`;
      box.appendChild(f);
      setTimeout(() => f.remove(), 700);
    };

    /** A trial's outcome is known: redraw the points, fireflies and dawn (game variant). */
    const count = (index: number, outcome: TrialOutcome) => {
      const before = outcomes[index];
      if (before === outcome) return;
      // A press stamped inside a window that closed a frame earlier replaces that trial's
      // "missed", exactly as the runner (and so the server) counts it.
      outcomes[index] = outcome;
      if (!game) return;
      const step = pointsSoFar(outcomes.filter((o) => o !== undefined));
      if (pointsEl.current) pointsEl.current.textContent = String(step.total);
      if (multEl.current) multEl.current.textContent = `×${step.multiplier}`;
      if (step.gained > 0) {
        addFly();
        float(step.gained);
      } else scatter();
      const root = scene.current;
      if (root) {
        root.style.setProperty('--dawn', (best ? step.total / best : 0).toFixed(3));
        root.style.setProperty('--streak', Math.min(1, step.streak / MAX_FLIES).toFixed(3));
      }
    };
    /** A trial whose window closed without a press: a held-back 3, or a missed digit. */
    const close = (index: number) => {
      if (index < 0 || outcomes[index] !== undefined) return;
      count(index, trialOutcome(plan.trials[index]!.isTarget, null));
    };
    const lightUp = (index: number, outcome: TrialOutcome) => {
      const el = lantern.current;
      if (el && index === current) el.dataset.glow = outcome === 'steady' ? 'ok' : 'bad';
      count(index, outcome);
    };

    const draw = (text: string, size: string, misted: boolean, index?: number) => {
      const el = stimulus.current;
      if (!el) return;
      el.textContent = text;
      el.style.fontSize = size;
      if (index !== undefined) el.dataset.index = String(index);
      if (frost.current) frost.current.dataset.on = String(misted);
    };

    const tick = (t: number) => {
      if (stopped) return;
      firstFrame ??= t;
      const elapsed = t - firstFrame;
      if (!started && elapsed < COUNTDOWN_S * 1000) {
        const n = COUNTDOWN_S - Math.floor(elapsed / 1000);
        if (shown !== `countdown${n}`) {
          shown = `countdown${n}`;
          setUi({ kind: 'countdown', n });
        }
        frameId = env.requestFrame(tick);
        return;
      }
      if (!started) {
        runner.start(t);
        started = true;
      }

      const view = runner.frame(t);
      if (view.phase === 'stimulus') {
        if (view.index !== current) {
          close(current);
          current = view.index;
          if (lantern.current) delete lantern.current.dataset.glow;
        }
        draw(String(view.digit), FONT_SIZE[view.fontSize]!, false, view.index);
      } else if (view.phase === 'mask') draw('', FONT_SIZE[2]!, true);
      else {
        close(current);
        draw('', FONT_SIZE[2]!, false);
      }

      const key =
        view.phase === 'stimulus' || view.phase === 'mask'
          ? 'trials'
          : view.phase === 'feedback'
            ? `feedback${view.index}`
            : view.phase;
      if (key !== shown) {
        shown = key;
        if (view.phase === 'stimulus' || view.phase === 'mask') setUi({ kind: 'trials' });
        else if (view.phase === 'feedback') setUi({ kind: 'feedback', outcome: view.outcome });
        else if (view.phase === 'probe') setUi({ kind: 'probe' });
        else if (view.phase === 'resume') setUi({ kind: 'resume' });
      }

      if (view.phase === 'done') {
        stopped = true;
        done(runner.submission());
        return;
      }
      frameId = env.requestFrame(tick);
    };

    frameId = env.requestFrame(tick);

    // Leaving the page interrupts the timing, so the block is abandoned (design note §5).
    const unsubscribe = env.onHidden(() => {
      if (stopped) return;
      stopped = true;
      env.cancelFrame(frameId);
      voided();
    });

    const press = (time: number, repeat?: boolean) => {
      const r = runner.press(time, { repeat });
      if (!r) return;
      lightUp(r.index, trialOutcome(r.isTarget, r.rt));
    };
    pressRef.current = press;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // no scrolling, no activating a focused button
        if (env.device === 'keyboard') press(env.pressTime(e), e.repeat);
      }
      const probeKey = ANSWERS.find((a) => a.key === e.key);
      if (probeKey) runner.answer(probeKey.answer, env.pressTime(e));
    };
    window.addEventListener('keydown', onKey);

    return () => {
      stopped = true;
      env.cancelFrame(frameId);
      unsubscribe();
      window.removeEventListener('keydown', onKey);
    };
  }, [plan, options, env, game]);

  const tap = (e: PointerEvent<HTMLDivElement>) => {
    if (env.device !== 'touch') return;
    e.preventDefault();
    pressRef.current?.(env.pressTime(e.nativeEvent));
  };

  const answer = (a: ProbeAnswer, event: Event) =>
    runnerRef.current?.answer(a, env.pressTime(event));

  const left = ui.kind === 'countdown' ? ui.n : 0;

  // Focus mode: the whole screen is the scene. No progress, count or timer is shown,
  // because knowing how far along you are changes how people respond.
  return (
    <div ref={focusRoot} className={styles.focus} tabIndex={-1}>
      <Scene ref={scene} />
      <div ref={flies} className={styles.flies} aria-hidden="true" />
      {game && (
        <div className={styles.hud} aria-hidden="true">
          <span ref={pointsEl} className={styles.points} data-testid="points">
            0
          </span>
          <span ref={multEl} className={styles.mult} data-testid="multiplier">
            ×1
          </span>
        </div>
      )}
      <div
        className={styles.stage}
        data-testid="tap-area"
        onPointerDown={tap}
        aria-hidden={ui.kind === 'trials'}
      >
        <div ref={lantern} className={styles.lantern} data-testid="lantern">
          <span className={styles.cap} />
          <div className={styles.glass}>
            {/* Always mounted, so the first digit can be drawn in the frame that starts it. */}
            <div ref={stimulus} className={styles.stimulus} data-testid="stimulus" />
            {/* The mask (Spec 006): the glass mists over the digit's place. */}
            <div ref={frost} className={styles.frost} data-testid="frost" data-on="false" />
          </div>
          <span className={styles.base} />
        </div>
        {ui.kind === 'countdown' && (
          <div className={styles.countdown} data-testid="countdown">
            <div className={styles.dots} aria-hidden="true">
              {Array.from({ length: COUNTDOWN_S }, (_, i) => (
                <i key={i} className={i < COUNTDOWN_S - left + 1 ? styles.on : undefined} />
              ))}
            </div>
            <p className={styles.word}>{COUNTDOWN_WORDS[left - 1]}</p>
            <p className={styles.ready}>
              {env.device === 'touch' ? 'Finger on the screen' : 'Finger on Space'}
            </p>
          </div>
        )}
        {ui.kind === 'feedback' && (
          <p
            data-testid="feedback"
            className={`${styles.feedback} ${FEEDBACK[ui.outcome].good ? styles.good : styles.bad}`}
          >
            {FEEDBACK[ui.outcome].text}
          </p>
        )}
      </div>

      {ui.kind === 'probe' && (
        <div role="dialog" aria-labelledby="probe-question" className={styles.probe}>
          <h2 id="probe-question">Where was your mind just now?</h2>
          <div className={styles.answers}>
            {ANSWERS.map((a) => (
              <Button
                key={a.answer}
                variant="secondary"
                size="lg"
                aria-label={a.label}
                onClick={(e) => answer(a.answer, e.nativeEvent)}
              >
                {a.label}
                {env.device === 'keyboard' && <kbd className={styles.key}>{a.key}</kbd>}
              </Button>
            ))}
          </div>
          {game && <p className={styles.probeNote}>Your answer never changes your points.</p>}
        </div>
      )}

      <p className={styles.hint}>{ui.kind === 'countdown' ? 'Starting…' : hint}</p>
    </div>
  );
}
