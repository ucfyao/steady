import type { InputDevice } from '@steady/core';

/**
 * One input method per session (Spec 004): touch on devices whose primary pointer is
 * coarse (phones, tablets), otherwise the keyboard (Space).
 */
export function detectDevice(
  matchMedia: ((query: string) => { matches: boolean }) | undefined = typeof window !== 'undefined'
    ? window.matchMedia?.bind(window)
    : undefined,
): InputDevice {
  return matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard';
}
