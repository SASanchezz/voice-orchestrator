// Reads a limit's reset time as Claude Code words it ("12:10am (Europe/Warsaw)", "9pm", "Nov 12, 3pm (Europe/Warsaw)").

const RESET_TIME = /^(?:([A-Za-z]{3})\w* (\d{1,2}),? )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*\(([^)]+)\))?$/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HALF_DAY_HOURS = 12;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

interface WallClock {
  month?: number;
  day?: number;
  hour: number;
  minute: number;
  timeZone?: string;
}

export function isResetTime(text: string): boolean {
  const zone = text.trim().match(RESET_TIME)?.[6];
  return RESET_TIME.test(text.trim()) && isKnownMonth(text) && (zone === undefined || isKnownZone(zone));
}

/** The first moment after `after` that the reset time names. */
export function resetTimeAfter(text: string, after: Date): Date {
  const clock = wallClockOf(text);
  const sameDay = instantOf(clock, calendarDayIn(after, clock.timeZone));
  if (sameDay > after) return sameDay;
  return clock.month === undefined ? new Date(sameDay.getTime() + DAY_MS) : nextYear(clock, after);
}

function wallClockOf(text: string): WallClock {
  const match = text.trim().match(RESET_TIME);
  if (!match || !isKnownMonth(text)) throw new Error(`Not a reset time: "${text}"`);
  const [, month, day, hour, minute, half, timeZone] = match;
  return {
    month: month === undefined ? undefined : MONTHS.indexOf(month.toLowerCase()),
    day: day === undefined ? undefined : Number(day),
    hour: (Number(hour) % HALF_DAY_HOURS) + (half.toLowerCase() === "pm" ? HALF_DAY_HOURS : 0),
    minute: Number(minute ?? 0),
    timeZone,
  };
}

function isKnownZone(timeZone: string): boolean {
  try {
    const format = new Intl.DateTimeFormat("en-US", { timeZone });
    return format.resolvedOptions().timeZone !== "";
  } catch {
    return false;
  }
}

function isKnownMonth(text: string): boolean {
  const month = text.trim().match(RESET_TIME)?.[1];
  return month === undefined || MONTHS.includes(month.toLowerCase());
}

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

function nextYear(clock: WallClock, after: Date): Date {
  const { year } = calendarDayIn(after, clock.timeZone);
  return instantOf(clock, { year: year + 1, month: 0, day: 1 });
}

/** The wall clock on its own date if it names one, else on `day`, in its time zone. */
function instantOf(clock: WallClock, day: CalendarDay): Date {
  const month = clock.month ?? day.month;
  const date = clock.day ?? day.day;
  const asUtc = Date.UTC(day.year, month, date, clock.hour, clock.minute);
  return new Date(asUtc - offsetMs(asUtc, clock.timeZone));
}

function calendarDayIn(moment: Date, timeZone: string | undefined): CalendarDay {
  const shifted = new Date(moment.getTime() + offsetMs(moment.getTime(), timeZone));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** How far the zone's clock is ahead of UTC at that moment; the Mac's own zone when none is named. */
function offsetMs(moment: number, timeZone: string | undefined): number {
  if (!timeZone) return -new Date(moment).getTimezoneOffset() * MINUTE_MS;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(moment);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return offsetFromName(name);
}

/** "GMT+01:00" → one hour; plain "GMT" → none. */
function offsetFromName(name: string): number {
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = (Number(hours) * MINUTES_PER_HOUR + Number(minutes)) * MINUTE_MS;
  return sign === "-" ? -total : total;
}
