// When a drafted reply's message came, as short as a list row allows. No imports, so the page bundles it and Node
// tests it.

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;

/** "now", "12m", "14:05" earlier today, "Yesterday", then "Nov 16" (with the year when it isn't this year's). */
export function compactWhen(at: Date, now: Date, locale?: string): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / MINUTE_MS);
  if (minutes < 1) return "now";
  if (minutes < HOUR_MINUTES) return `${minutes}m`;
  if (isSameDay(at, now)) return at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(at, dayBefore(now))) return "Yesterday";
  const year: Intl.DateTimeFormatOptions = at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" };
  return at.toLocaleDateString(locale, { month: "short", day: "numeric", ...year });
}

function dayBefore(day: Date): Date {
  const before = new Date(day);
  before.setDate(day.getDate() - 1);
  return before;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
