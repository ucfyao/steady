import { act } from '@testing-library/react';
import type { InputDevice, Variant } from '@steady/core';
import type { PlayEnv } from '../../src/game/env.js';

/** A manual clock: frames only run when the test advances time. */
export function fakeEnv(device: InputDevice = 'keyboard', variantOverride?: Variant) {
  let now = 0;
  let nextId = 1;
  let queue = new Map<number, (t: number) => void>();
  const hidden = new Set<() => void>();

  const env: PlayEnv = {
    requestFrame: (cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    },
    cancelFrame: (id) => void queue.delete(id),
    pressTime: () => now,
    onHidden: (cb) => {
      hidden.add(cb);
      return () => hidden.delete(cb);
    },
    device,
    variantOverride,
  };

  /** Runs one frame at the current time. */
  function frame() {
    const due = queue;
    queue = new Map();
    act(() => due.forEach((cb) => cb(now)));
  }

  return {
    env,
    now: () => now,
    /** Moves time forward in frames of `step` ms, calling `each` after every frame. */
    advance(ms: number, step = 50, each?: () => void) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(now + step, end);
        frame();
        each?.();
      }
    },
    frame,
    hide: () => act(() => hidden.forEach((cb) => cb())),
  };
}
