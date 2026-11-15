/** Injected so tests can control elapsed time (Spec 003 timing rules). */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
