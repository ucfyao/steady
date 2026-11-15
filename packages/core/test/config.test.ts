import { describe, expect, it } from 'vitest';
import { SUBMIT_CONFIG } from '../src/index.js';

// Worked out from Spec 003, not from the config: 126 trials × 1150 ms × 0.95, and 30 minutes.
describe('SUBMIT_CONFIG', () => {
  it('requires at least 95% of the pure trial time', () => {
    expect(SUBMIT_CONFIG.minElapsedMs).toBe(137_655);
  });

  it('expires an open session after 30 minutes', () => {
    expect(SUBMIT_CONFIG.expiresAfterMs).toBe(1_800_000);
  });
});
