import { SART_CONFIG, type PlanTrial, type ProbeAnswer, type Submission } from '@steady/core';

export interface RunnerPlan {
  trials: PlanTrial[];
  probeAfter: number[];
}

export interface RunnerOptions {
  /** Pause after a probe answer before the next trial (ms). */
  resumeMs?: number;
  /** Practice only: feedback shown after each trial (ms). 0 = no feedback. */
  feedbackMs?: number;
}

/** Practice feedback for one trial. Not a score: it is never sent anywhere. */
export type Outcome = 'caught' | 'commission' | 'omission' | 'hit';

export type RunnerView =
  | { phase: 'waiting' }
  | { phase: 'stimulus'; index: number; digit: number; fontSize: number }
  | { phase: 'mask'; index: number }
  | { phase: 'feedback'; index: number; outcome: Outcome }
  | { phase: 'probe'; probeIndex: number }
  | { phase: 'resume' }
  | { phase: 'done' };

const TRIAL_MS = SART_CONFIG.stimulusMs + SART_CONFIG.maskMs;

/**
 * Runs one block of SART trials from frame and press timestamps (Spec 004).
 * Pure: no DOM, no timers. The caller passes requestAnimationFrame timestamps to
 * frame() and event.timeStamp to press(), both on the performance.now() clock.
 */
export class TrialRunner {
  private readonly trials: PlanTrial[];
  private readonly probeAfter: number[];
  private readonly resumeMs: number;
  private readonly feedbackMs: number;

  private readonly onsets: number[] = [];
  private readonly rts: (number | null)[];
  private readonly answers: ProbeAnswer[] = [];

  private view: RunnerView = { phase: 'waiting' };
  /** When the next trial may start (its onset is the first frame at or after this). */
  private nextDue: number | null = null;
  /** End of the current feedback or resume pause. */
  private pauseUntil = 0;

  constructor(plan: RunnerPlan, options: RunnerOptions = {}) {
    this.trials = plan.trials;
    this.probeAfter = plan.probeAfter;
    this.resumeMs = options.resumeMs ?? 1000;
    this.feedbackMs = options.feedbackMs ?? 0;
    this.rts = plan.trials.map(() => null);
  }

  start(now: number): void {
    this.nextDue = now;
  }

  frame(now: number): RunnerView {
    const v = this.view;
    if (v.phase === 'probe' || v.phase === 'done' || this.nextDue === null) return v;

    if (v.phase === 'stimulus' || v.phase === 'mask') {
      const onset = this.onsets[v.index]!;
      if (now < onset + SART_CONFIG.stimulusMs) return v;
      if (now < onset + TRIAL_MS) return this.show({ phase: 'mask', index: v.index });
      return this.endTrial(v.index, now);
    }

    if ((v.phase === 'feedback' || v.phase === 'resume') && now < this.pauseUntil) return v;
    if (v.phase === 'feedback' && this.onsets.length === this.trials.length) {
      return this.show({ phase: 'done' });
    }
    if (now >= this.nextDue) return this.startTrial(this.onsets.length, now);
    return v;
  }

  press(time: number, opts: { repeat?: boolean } = {}): void {
    if (opts.repeat) return;
    // The trial whose window [onset, onset + 1150) contains the press, if any.
    for (let i = this.onsets.length - 1; i >= 0; i--) {
      const onset = this.onsets[i]!;
      if (time < onset) continue;
      if (time < onset + TRIAL_MS && this.rts[i] === null) this.rts[i] = time - onset;
      return;
    }
  }

  answer(answer: ProbeAnswer, now: number): void {
    if (this.view.phase !== 'probe') return;
    this.answers.push(answer);
    this.pauseUntil = now + this.resumeMs;
    this.nextDue = this.pauseUntil;
    this.show({ phase: 'resume' });
  }

  submission(): Submission {
    if (this.view.phase !== 'done') throw new Error('The session is not finished yet');
    return { rts: [...this.rts], probeAnswers: [...this.answers] };
  }

  private startTrial(index: number, now: number): RunnerView {
    const trial = this.trials[index]!;
    this.onsets[index] = now;
    return this.show({
      phase: 'stimulus',
      index,
      digit: trial.digit,
      fontSize: trial.fontSize,
    });
  }

  private endTrial(index: number, now: number): RunnerView {
    const windowEnd = this.onsets[index]! + TRIAL_MS;
    const isLast = index === this.trials.length - 1;

    if (this.feedbackMs > 0) {
      this.pauseUntil = now + this.feedbackMs;
      this.nextDue = this.pauseUntil;
      return this.show({ phase: 'feedback', index, outcome: this.outcome(index) });
    }
    if (isLast) return this.show({ phase: 'done' });

    const probeIndex = this.probeAfter.indexOf(index);
    if (probeIndex !== -1) return this.show({ phase: 'probe', probeIndex });

    this.nextDue = windowEnd;
    return this.startTrial(index + 1, now);
  }

  private outcome(index: number): Outcome {
    const pressed = this.rts[index] !== null;
    if (this.trials[index]!.isTarget) return pressed ? 'commission' : 'caught';
    return pressed ? 'hit' : 'omission';
  }

  private show(view: RunnerView): RunnerView {
    this.view = view;
    return view;
  }
}
