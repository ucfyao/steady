import { SART_CONFIG, mulberry32, type PlanTrial } from '@steady/core';
import type { TrialTiming } from './runner.js';

const PRACTICE_TARGETS = 2; // [P] 18 trials, 2 of them 3s (≈11% no-go, as in the main block)
const NO_TARGET_AT_START = 3; // [P]
/** [P] Spec 004: practice starts slow and ends at the real speed, 6 trials per step. */
const PRACTICE_SPEEDS: TrialTiming[] = [
  { stimulusMs: 800, maskMs: 1200 },
  { stimulusMs: 500, maskMs: 1000 },
  { stimulusMs: SART_CONFIG.stimulusMs, maskMs: SART_CONFIG.maskMs },
];

/**
 * The practice round (Spec 004): every non-target digit twice plus two 3s, shuffled
 * with the seed until no digit repeats and the first three trials have no 3. It starts
 * slow and the last steps run at the real speed.
 * Generated on the client and never submitted.
 */
export function createPracticePlan(seed: number): {
  trials: PlanTrial[];
  probeAfter: number[];
  timing: TrialTiming[];
} {
  const rng = mulberry32(seed);
  const go = SART_CONFIG.digits.filter((d) => d !== SART_CONFIG.targetDigit);
  const digits = [...go, ...go, ...Array<number>(PRACTICE_TARGETS).fill(SART_CONFIG.targetDigit)];

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
