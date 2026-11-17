import { VARIANTS, type InputDevice, type Variant } from '@steady/core';
import { detectDevice } from './device.js';

/**
 * Everything the game needs from the browser, so tests can drive it with a fake clock.
 * Frame callbacks receive requestAnimationFrame timestamps; pressTime returns
 * event.timeStamp. Both are on the performance.now() clock.
 */
export interface PlayEnv {
  requestFrame(cb: (time: number) => void): number;
  cancelFrame(id: number): void;
  pressTime(event: Event): number;
  /** Calls `cb` when the page becomes hidden; returns an unsubscribe function. */
  onHidden(cb: () => void): () => void;
  device: InputDevice;
  /** A play-test override from `?variant=` when the app was opened (Spec 006 §5). */
  variantOverride?: Variant;
}

/** `plain`, `calm` or `game` from a query string, or undefined. */
export function parseVariant(search: string): Variant | undefined {
  const v = new URLSearchParams(search).get('variant');
  return VARIANTS.find((x) => x === v);
}

/** Read once when the app loads, so it lasts until the app is reopened without it. */
export const STARTUP_OVERRIDE =
  typeof window === 'undefined' ? undefined : parseVariant(window.location.search);

export function browserEnv(): PlayEnv {
  return {
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
    pressTime: (e) => e.timeStamp,
    onHidden: (cb) => {
      const listener = () => document.visibilityState === 'hidden' && cb();
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
    device: detectDevice(),
    variantOverride: STARTUP_OVERRIDE,
  };
}
