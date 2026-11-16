import { SART_CONFIG, mulberry32, type PlanTrial } from '@steady/core';
import type { TrialTiming } from './runner.js';

const PRACTICE_TARGETS = 2; // [P] 12 trials, 2 of them 3s (Spec 005)
const EXTRA_GO = 2; // [P] go digits drawn twice, on top of every go digit once
const NO_TARGET_AT_START = 3; // [P]
/** [P] Spec 005: practice starts slow and ends at the real speed, 4 trials per step. */
const PRACTICE_SPEEDS: TrialTiming[] = [
  { stimulusMs: 800, maskMs: 1200 },
  { stimulusMs: 500, maskMs: 1000 },
  { stimulusMs: SART_CONFIG.stimulusMs, maskMs: SART_CONFIG.maskMs },
];

/**
 * The practice round (Spec 005): every non-target digit once, two more drawn by the seed,
 * and two 3s, shuffled with the seed until no digit repeats and the first three trials
 * have no 3. It starts slow and the last steps run at the real speed.
 * Generated on the client and never submitted.
 */
export function createPracticePlan(seed: number): {
  trials: PlanTrial[];
  probeAfter: number[];
  timing: TrialTiming[];
} {
  const rng = mulberry32(seed);
  const go = SART_CONFIG.digits.filter((d) => d !== SART_CONFIG.targetDigit);
  const extra = Array.from({ length: EXTRA_GO }, () => go[Math.floor(rng() * go.length)]!);
  const digits = [
    ...go,
    ...extra,
    ...Array<number>(PRACTICE_TARGETS).fill(SART_CONFIG.targetDigit),
  ];

  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j]!, digits[i]!];
    }
    const ok =
      digits.every((d, i) => i === 0 || d !== digits[i - 1]) &&
      !digits.slice(0, NO_TARGET_AT_START).includes(SART_CONFIG.targetDigit);
    if (ok) {
      const trials = digits.map((digit, index) => ({
        index,
        digit,
        isTarget: digit === SART_CONFIG.targetDigit,
        fontSize: Math.floor(rng() * SART_CONFIG.fontSizes),
      }));
      const perStep = trials.length / PRACTICE_SPEEDS.length;
      const timing = trials.map((_, i) => PRACTICE_SPEEDS[Math.floor(i / perStep)]!);
      return { trials, probeAfter: [], timing };
    }
  }
  throw new Error('could not build a practice sequence');
}

export interface PracticeSummary {
  heldBack: number;
  targets: number;
  caught: number;
  digits: number;
  tooEarly: number;
  pressedOn3: number;
  missed: number;
}

/**
 * Practice result (Spec 004). Computed in the browser for the player only; never sent or
 * saved. A press under core's anticipation threshold is "too early", not a caught digit.
 */
export function summarisePractice(trials: PlanTrial[], rts: (number | null)[]): PracticeSummary {
  const s: PracticeSummary = {
    heldBack: 0,
    targets: 0,
    caught: 0,
    digits: 0,
    tooEarly: 0,
    pressedOn3: 0,
    missed: 0,
  };
  trials.forEach((trial, i) => {
    const rt = rts[i] ?? null;
    if (trial.isTarget) {
      s.targets++;
      if (rt === null) s.heldBack++;
      else s.pressedOn3++;
      return;
    }
    s.digits++;
    if (rt === null) s.missed++;
    else if (rt < SART_CONFIG.anticipationMs) s.tooEarly++;
    else s.caught++;
  });
  return s;
}

export type PracticeTip = 'pressed-3' | 'missed' | 'too-early' | 'clean';

/** The one tip after practice: about the most common slip (ties: 3s, then misses). */
export function practiceTip(s: PracticeSummary): PracticeTip {
  const slips: [PracticeTip, number][] = [
    ['pressed-3', s.pressedOn3],
    ['missed', s.missed],
    ['too-early', s.tooEarly],
  ];
  let best: [PracticeTip, number] = ['clean', 0];
  for (const slip of slips) if (slip[1] > best[1]) best = slip;
  return best[0];
}
