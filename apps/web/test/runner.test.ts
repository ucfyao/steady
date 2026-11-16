import { SUBMIT_CONFIG, createSessionPlan, validateSubmission, type PlanTrial } from '@steady/core';
import { describe, expect, it } from 'vitest';
import { TrialRunner, type RunnerPlan, type RunnerView } from '../src/game/runner.js';

// Values from Spec 004 / design note §3, not from the runner: 250 ms digit, 900 ms mask.
const TRIAL_MS = 1150;
const STIMULUS_MS = 250;

const go = (index: number, digit = 5): PlanTrial => ({
  index,
  digit,
  isTarget: false,
  fontSize: 2,
});
const three = (index: number): PlanTrial => ({ index, digit: 3, isTarget: true, fontSize: 0 });
const plan = (
  trials: PlanTrial[],
  probeAfter: number[] = [],
  timing?: RunnerPlan['timing'],
): RunnerPlan => ({ trials, probeAfter, ...(timing && { timing }) });

/** Calls frame() every `step` ms from `from` up to and including `to`; returns the last view. */
function frames(r: TrialRunner, from: number, to: number, step = 10): RunnerView {
  let view: RunnerView = { phase: 'waiting' };
  for (let t = from; t <= to; t += step) view = r.frame(t);
  return view;
}

describe('TrialRunner timing', () => {
  it('uses the first frame at or after start as the onset, and measures RT from it', () => {
    const r = new TrialRunner(plan([go(0)]));
    r.start(1000);
    expect(r.frame(1004)).toEqual({ phase: 'stimulus', index: 0, digit: 5, fontSize: 2 });
    r.press(1304);
    frames(r, 1014, 1004 + TRIAL_MS);
    expect(r.submission().rts).toEqual([300]);
  });

  it('shows the digit for 250 ms, then the mask', () => {
    const r = new TrialRunner(plan([go(0), go(1, 7)]));
    r.start(0);
    r.frame(0);
    expect(r.frame(STIMULUS_MS - 1).phase).toBe('stimulus');
    expect(r.frame(STIMULUS_MS)).toEqual({ phase: 'mask', index: 0 });
    expect(r.frame(TRIAL_MS - 1)).toEqual({ phase: 'mask', index: 0 });
  });

  it('starts the next trial on the first frame at or after the previous onset + 1150 ms', () => {
    const r = new TrialRunner(plan([go(0), go(1, 7)]));
    r.start(0);
    r.frame(0);
    expect(r.frame(1140).phase).toBe('mask');
    // No frame lands exactly on 1150; the next one (1157) is the onset of trial 1.
    expect(r.frame(1157)).toMatchObject({ phase: 'stimulus', index: 1, digit: 7 });
    r.press(1157 + 420);
    frames(r, 1167, 1157 + TRIAL_MS + 10);
    expect(r.submission().rts).toEqual([null, 420]);
  });

  it('counts only the first press in a window and ignores key repeats', () => {
    const r = new TrialRunner(plan([go(0), go(1)]));
    r.start(0);
    r.frame(0);
    r.press(500, { repeat: true });
    r.press(600);
    r.press(700);
    frames(r, 10, 2400);
    expect(r.submission().rts).toEqual([600, null]);
  });

  it('ignores presses before the first digit and in the gap before the next digit', () => {
    const r = new TrialRunner(plan([go(0), go(1)]));
    r.start(100);
    r.press(50);
    r.frame(105); // onset 105, window ends 1255
    frames(r, 115, 1255 - 5);
    r.press(1256); // after window 0, before the next frame shows trial 1
    expect(r.frame(1260)).toMatchObject({ phase: 'stimulus', index: 1 });
    frames(r, 1270, 2500);
    expect(r.submission().rts).toEqual([null, null]);
  });

  it('closes a window exactly 1150 ms after its onset', () => {
    const r = new TrialRunner(plan([go(0), go(1)]));
    r.start(0);
    frames(r, 0, 1140);
    r.press(1149); // last moment of trial 0's window
    const late = new TrialRunner(plan([go(0), go(1)]));
    late.start(0);
    frames(late, 0, 1140);
    late.press(1150); // window closed; trial 1 is not on screen yet
    frames(r, 1150, 2400);
    frames(late, 1150, 2400);
    expect(r.submission().rts).toEqual([1149, null]);
    expect(late.submission().rts).toEqual([null, null]);
  });

  it('assigns a press by its timestamp even when it is handled after a later frame', () => {
    const r = new TrialRunner(plan([go(0), go(1)]));
    r.start(0);
    frames(r, 0, 1160); // trial 1 onset at 1150
    r.press(1100); // event from trial 0's window, handled late
    r.press(1150 + 380);
    frames(r, 1170, 2400);
    expect(r.submission().rts).toEqual([1100, 380]);
  });

  it('records a press on a 3 like any other press', () => {
    const r = new TrialRunner(plan([go(0), three(1)]));
    r.start(0);
    frames(r, 0, 1150);
    r.press(1150 + 250);
    frames(r, 1160, 2400);
    expect(r.submission().rts).toEqual([null, 250]);
  });
});

describe('TrialRunner per-trial timing (practice)', () => {
  it('shows each trial for its own digit and mask time, with a window that long', () => {
    // Trial 0 is slow (800 + 1200 = 2000 ms); trial 1 uses the real timing.
    const slow = { stimulusMs: 800, maskMs: 1200 };
    const real = { stimulusMs: 250, maskMs: 900 };
    const r = new TrialRunner(plan([go(0), go(1, 7), go(2)], [], [slow, real, real]));
    r.start(0);
    r.frame(0);
    expect(r.frame(799).phase).toBe('stimulus');
    expect(r.frame(800)).toEqual({ phase: 'mask', index: 0 });
    r.press(1900); // past 1150 ms, still inside trial 0's 2000 ms window
    expect(r.frame(1990)).toEqual({ phase: 'mask', index: 0 });
    expect(r.frame(2000)).toMatchObject({ phase: 'stimulus', index: 1 });
    expect(r.frame(2249).phase).toBe('stimulus');
    expect(r.frame(2250)).toEqual({ phase: 'mask', index: 1 });
    r.press(2000 + 1150); // trial 1's window has closed
    expect(r.frame(3150)).toMatchObject({ phase: 'stimulus', index: 2 });
    frames(r, 3160, 4400);
    expect(r.submission().rts).toEqual([1900, null, null]);
  });
});

describe('TrialRunner probes', () => {
  it('pauses after the probe trial and resumes 1 s after the answer', () => {
    const r = new TrialRunner(plan([go(0), go(1), go(2)], [1]));
    r.start(0);
    frames(r, 0, 2290); // trial 1 onset 1150, window ends 2300
    expect(r.frame(2300)).toEqual({ phase: 'probe', probeIndex: 0 });
    // The clock is paused: frames and presses do nothing.
    r.press(5000);
    expect(r.frame(9000)).toEqual({ phase: 'probe', probeIndex: 0 });

    r.answer('drifting', 9000);
    expect(r.frame(9500)).toEqual({ phase: 'resume' });
    expect(r.frame(9990)).toEqual({ phase: 'resume' });
    expect(r.frame(10_000)).toMatchObject({ phase: 'stimulus', index: 2 });
    r.press(10_000 + 333);
    frames(r, 10_010, 11_200);
    expect(r.submission()).toEqual({ rts: [null, null, 333], probeAnswers: ['drifting'] });
  });

  it('ignores an answer when no probe is showing', () => {
    const r = new TrialRunner(plan([go(0)], []));
    r.start(0);
    r.frame(0);
    r.answer('on_task', 100);
    frames(r, 10, 1200);
    expect(r.submission().probeAnswers).toEqual([]);
  });
});

describe('TrialRunner practice feedback', () => {
  it('shows the outcome of each trial before the next one starts', () => {
    const r = new TrialRunner(plan([go(0), three(1), three(2), go(3)]), { feedbackMs: 800 });
    r.start(0);
    r.frame(0);
    r.press(400); // trial 0: pressed a go digit
    expect(r.frame(1150)).toEqual({ phase: 'feedback', index: 0, outcome: 'hit' });
    expect(r.frame(1940)).toMatchObject({ phase: 'feedback', index: 0 });
    expect(r.frame(1950)).toMatchObject({ phase: 'stimulus', index: 1 }); // 1150 + 800

    // trial 1: withheld on a 3
    expect(r.frame(1950 + 1150)).toEqual({ phase: 'feedback', index: 1, outcome: 'caught' });
    const t2 = 1950 + 1150 + 800;
    expect(r.frame(t2)).toMatchObject({ phase: 'stimulus', index: 2 });
    r.press(t2 + 300); // trial 2: pressed on a 3
    expect(r.frame(t2 + 1150)).toEqual({ phase: 'feedback', index: 2, outcome: 'commission' });
    const t3 = t2 + 1150 + 800;
    r.frame(t3); // trial 3: no press
    expect(r.frame(t3 + 1150)).toEqual({ phase: 'feedback', index: 3, outcome: 'omission' });
    expect(r.frame(t3 + 1150 + 800)).toEqual({ phase: 'done' });
  });

  it('calls a press under 100 ms on a digit "too soon" (core anticipation threshold)', () => {
    const r = new TrialRunner(plan([go(0), three(1)]), { feedbackMs: 800 });
    r.start(0);
    r.frame(0);
    r.press(99);
    expect(r.frame(1150)).toEqual({ phase: 'feedback', index: 0, outcome: 'early' });
    r.frame(1950);
    r.press(1950 + 50); // a very early press on a 3 is still a press on a 3
    expect(r.frame(1950 + 1150)).toEqual({ phase: 'feedback', index: 1, outcome: 'commission' });
  });

  it('a press at exactly 100 ms is not too soon', () => {
    const r = new TrialRunner(plan([go(0)]), { feedbackMs: 800 });
    r.start(0);
    r.frame(0);
    r.press(100);
    expect(r.frame(1150)).toEqual({ phase: 'feedback', index: 0, outcome: 'hit' });
  });
});

describe('TrialRunner full session', () => {
  it('produces a valid submission for a real plan, taking at least the minimum time', () => {
    const p = createSessionPlan(2026);
    const r = new TrialRunner(p);
    const step = 1000 / 60;
    let t = 0;
    r.start(t);
    let lastIndex = -1;
    let view = r.frame(t);
    while (view.phase !== 'done') {
      if (view.phase === 'stimulus' && view.index !== lastIndex) {
        lastIndex = view.index;
        if (!p.trials[view.index]!.isTarget) r.press(t + 400);
      }
      if (view.phase === 'probe') {
        r.answer('on_task', t + 2000);
        t += 2000;
      }
      t += step;
      view = r.frame(t);
    }
    const s = r.submission();
    expect(validateSubmission(p, s)).toEqual({ ok: true });
    expect(s.rts.filter((rt, i) => p.trials[i]!.isTarget && rt !== null)).toEqual([]);
    expect(s.rts.filter((rt) => rt !== null)).toHaveLength(112);
    for (const rt of s.rts) if (rt !== null) expect(rt).toBeCloseTo(400, 6);
    expect(t).toBeGreaterThanOrEqual(SUBMIT_CONFIG.minElapsedMs);
  });

  it('refuses to produce a submission before the session is done', () => {
    const r = new TrialRunner(plan([go(0)]));
    r.start(0);
    r.frame(0);
    expect(() => r.submission()).toThrow(/not finished/);
  });
});
