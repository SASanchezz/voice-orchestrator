const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** Whole seconds since an epoch-ms time; never negative, even if the clocks disagree. */
export function secondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / MS_PER_SECOND));
}

/** How long since an epoch-ms time, as m:ss, or h:mm:ss from an hour on. */
export function elapsedSince(startedAt: number): string {
  const seconds = secondsSince(startedAt);
  const totalMinutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secondsPart = twoDigits(seconds % SECONDS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) return `${totalMinutes}:${secondsPart}`;
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  return `${hours}:${twoDigits(totalMinutes % MINUTES_PER_HOUR)}:${secondsPart}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
