import type { InputDevice } from '@steady/core';
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
}

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
  };
}
