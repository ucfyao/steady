import { SART_CONFIG, mulberry32, type PlanTrial } from '@steady/core';

const PRACTICE_TARGETS = 2; // [P] 18 trials, 2 of them 3s (≈11% no-go, as in the main block)
const NO_TARGET_AT_START = 3; // [P]

/**
 * The practice round (Spec 004): every non-target digit twice plus two 3s, shuffled
 * with the seed until no digit repeats and the first three trials have no 3.
 * Generated on the client and never submitted.
 */
export function createPracticePlan(seed: number): { trials: PlanTrial[]; probeAfter: number[] } {
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
      return { trials, probeAfter: [] };
    }
  }
  throw new Error('could not build a practice sequence');
}
