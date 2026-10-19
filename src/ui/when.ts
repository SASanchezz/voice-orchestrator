// When something happened, as the page shows it: the time alone for today, the date and time for older days.
// Formatted in the browser's own time zone and language. No imports, so the page bundles it and Node tests it.

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** "14:05" today, "Oct 13, 14:05" on an earlier day this year, "Oct 13, 2025, 14:05" before that. */
export function formatWhen(at: Date, now: Date, locale?: string): string {
  if (sameDay(at, now)) return at.toLocaleTimeString(locale, TIME);
  const year: Intl.DateTimeFormatOptions = at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" };
  return at.toLocaleString(locale, { ...DAY, ...year, ...TIME });
}

/** How long something has waited: "just now", "12 min ago", or for over an hour "since 14:05" / "since Oct 13, 14:05". */
export function formatWaiting(since: Date, now: Date, locale?: string): string {
  const minutes = Math.round((now.getTime() - since.getTime()) / MINUTE_MS);
  if (minutes < 1) return "just now";
  return minutes < HOUR_MINUTES ? `${minutes} min ago` : `since ${formatWhen(since, now, locale)}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
