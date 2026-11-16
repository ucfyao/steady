/** The UI is in English, so day names are too (not the device's language). */
const LOCALE = 'en-AU';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * When the last check was, as Home shows it: "Today", "Yesterday", a weekday within
 * the last 7 local days, then "9 Nov". Local calendar days, like the weekly target.
 */
export function lastCheckDay(completedAt: string, now: Date): string {
  const day = startOfDay(new Date(completedAt));
  const today = startOfDay(now);
  // Rounded, so a daylight-saving change (a 23- or 25-hour day) cannot skew it.
  const ago = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (ago <= 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago < 7) return day.toLocaleDateString(LOCALE, { weekday: 'short' });
  return day.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

/** A one-letter day name for the week dots ("M", "T", …). */
export const dayLetter = (d: Date) => d.toLocaleDateString(LOCALE, { weekday: 'narrow' });
