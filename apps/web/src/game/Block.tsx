import type { ProbeAnswer, Submission } from '@steady/core';
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import type { PlayEnv } from './env.js';
import { TrialRunner, type Outcome, type RunnerOptions, type RunnerPlan } from './runner.js';

const COUNTDOWN_S = 3;
/** [R] PsyToolkit SART: five font sizes (48–120 pt), used here as px. */
const FONT_PX = [48, 72, 94, 100, 120] as const;
const MASK = '⊗';

const FEEDBACK: Record<Outcome, string> = {
  hit: '✓',
  caught: 'Caught it',
  commission: 'That was a 3',
  omission: 'Missed one',
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
 * One block of trials (practice or the real session). The digit is written straight
 * into the DOM inside the animation-frame callback, so it is on screen in the frame
 * whose timestamp becomes its onset; React renders only the countdown, feedback and probe.
 */
export function Block({
  plan,
  options,
  env,
  onDone,
  onVoid,
}: {
  plan: RunnerPlan;
  options?: RunnerOptions;
  env: PlayEnv;
  onDone(submission: Submission): void;
  onVoid(): void;
}) {
  const stimulus = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<TrialRunner | null>(null);
  const [ui, setUi] = useState<Ui>({ kind: 'countdown', n: COUNTDOWN_S });
  const done = useEffectEvent(onDone);
  const voided = useEffectEvent(onVoid);

  useEffect(() => {
    const runner = new TrialRunner(plan, options);
    runnerRef.current = runner;
    let frameId = 0;
    let stopped = false;
    let firstFrame: number | null = null;
    let started = false;
    let shown = '';

    const draw = (el: HTMLDivElement, text: string, sizePx: number, index?: number) => {
      el.textContent = text;
      el.style.fontSize = `${sizePx}px`;
      if (index !== undefined) el.dataset.index = String(index);
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
      const el = stimulus.current;
      if (el) {
        if (view.phase === 'stimulus')
          draw(el, String(view.digit), FONT_PX[view.fontSize]!, view.index);
        else if (view.phase === 'mask') draw(el, MASK, FONT_PX[2]);
        else draw(el, '', FONT_PX[2]);
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

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // no scrolling, no activating a focused button
        if (env.device === 'keyboard') runner.press(env.pressTime(e), { repeat: e.repeat });
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
  }, [plan, options, env]);

  const tap = (e: PointerEvent<HTMLDivElement>) => {
    if (env.device !== 'touch') return;
    e.preventDefault();
    runnerRef.current?.press(env.pressTime(e.nativeEvent));
  };

  const answer = (a: ProbeAnswer, event: Event) =>
    runnerRef.current?.answer(a, env.pressTime(event));

  return (
    <div className="stage">
      <div
        className="tap-area"
        data-testid="tap-area"
        onPointerDown={tap}
        aria-hidden={ui.kind === 'trials'}
      >
        {ui.kind === 'countdown' && <p className="countdown">{ui.n}</p>}
        {/* Always mounted, so the first digit can be drawn in the frame that starts it. */}
        <div ref={stimulus} className="stimulus" data-testid="stimulus" />
        {ui.kind === 'feedback' && (
          <p className={`feedback feedback-${ui.outcome}`}>{FEEDBACK[ui.outcome]}</p>
        )}
      </div>

      {ui.kind === 'probe' && (
        <div role="dialog" aria-labelledby="probe-question" className="probe">
          <h2 id="probe-question">Where was your mind just now?</h2>
          <div className="probe-answers">
            {ANSWERS.map((a) => (
              <button
                key={a.answer}
                type="button"
                aria-label={a.label}
                onClick={(e) => answer(a.answer, e.nativeEvent)}
              >
                {a.label}
                {env.device === 'keyboard' && <kbd>{a.key}</kbd>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
