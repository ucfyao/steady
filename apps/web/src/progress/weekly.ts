import { PROGRESS_CONFIG } from '@steady/core';

export interface WeeklyTarget {
  /** One per local day, oldest first; the last one is today. */
  days: boolean[];
  count: number;
  target: number;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The weekly target (Spec 004): distinct local calendar days with a completed session,
 * over today and the days before it. Uses the device's clock and time zone, which is
 * why the server does not compute it.
 */
export function weeklyTarget(completedAt: string[], now: Date): WeeklyTarget {
  const { weeklyWindowDays: window, weeklyTargetDays: target } = PROGRESS_CONFIG;
  // A session after today (another device's clock) falls outside the days below.
  const played = new Set(completedAt.map((iso) => dayKey(new Date(iso))));
  // new Date(y, m, d - i) steps by calendar day, so daylight-saving changes cannot skew it.
  const days = Array.from({ length: window }, (_, k) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (window - 1 - k));
    return played.has(dayKey(day));
  });
  return { days, count: days.filter(Boolean).length, target };
}
