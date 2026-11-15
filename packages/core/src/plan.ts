import { SART_CONFIG as C } from './config.js';
import type { PlanTrial, SessionPlan } from './types.js';

const MAX_ATTEMPTS = 1000;

/** mulberry32: small, fast, deterministic 32-bit PRNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Balanced digit sequence with no adjacent repeats: greedy draw weighted by
 * remaining copies, never repeating the previous digit; retry on a dead end.
 */
function drawDigits(rng: () => number): number[] {
  const total = C.digits.length * C.copiesPerDigit;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remaining = new Map<number, number>(C.digits.map((d) => [d, C.copiesPerDigit]));
    const seq: number[] = [];
    let prev = -1;

    while (seq.length < total) {
      const inWarmup = seq.length < C.warmupTrials;
      const candidates = C.digits.filter(
        (d) => d !== prev && remaining.get(d)! > 0 && !(inWarmup && d === C.targetDigit),
      );
      if (candidates.length === 0) break; // dead end: only the previous digit is left

      const weight = candidates.reduce((acc, d) => acc + remaining.get(d)!, 0);
      let r = rng() * weight;
      let pick = candidates[candidates.length - 1]!;
      for (const d of candidates) {
        r -= remaining.get(d)!;
        if (r < 0) {
          pick = d;
          break;
        }
      }
      seq.push(pick);
      remaining.set(pick, remaining.get(pick)! - 1);
      prev = pick;
    }
    if (seq.length === total) return seq;
  }
  throw new Error('could not build a digit sequence');
}

function drawProbes(rng: () => number, trials: PlanTrial[]): number[] {
  const span = C.probeGapMax - C.probeGapMin + 1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const positions: number[] = [];
    let prev = -1;
    for (let k = 0; k < C.probesPerSession; k++) {
      let p = prev + C.probeGapMin + Math.floor(rng() * span);
      // Probes follow a go trial; targets are never adjacent, so p − 1 is a go trial.
      if (trials[p]?.isTarget) p -= 1;
      positions.push(p);
      prev = p;
    }
    if (prev <= C.lastProbeMaxIndex) return positions;
  }
  throw new Error('could not place probes');
}

export function createSessionPlan(seed: number): SessionPlan {
  const rng = mulberry32(seed);
  const trials: PlanTrial[] = drawDigits(rng).map((digit, index) => ({
    index,
    digit,
    isTarget: digit === C.targetDigit,
    fontSize: Math.floor(rng() * C.fontSizes),
  }));
  return { seed, trials, probeAfter: drawProbes(rng, trials) };
}
