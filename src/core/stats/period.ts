// Stats periods in the user's time zone (S1 stats: "Periods use the user's time zone").
// A period is a half-open range of UTC instants [from, to), so it can filter stored timestamptz values.
// Local midnights are found with Intl (no date library); DST changes are handled, and so is a zone
// where midnight doesn't exist on the day of the change (the day then starts at 01:00).

export type Period = "week" | "month" | "year" | "all";

/** UTC milliseconds, half-open: from ≤ t < to. `null` means all time. */
export type TimeRange = { from: number; to: number } | null;

export type PeriodOptions = {
  /** IANA name from `profiles.time_zone`. Unknown names fall back to UTC. */
  timeZone: string;
  /** First day of the week, 1 = Monday … 7 = Sunday (see `weekStartFor`). */
  weekStart: number;
  /** 0 = the period containing `now`, -1 = the one before (e.g. last week's recap). */
  offset?: number;
  now?: number;
};

type LocalDate = { year: number; month: number; day: number }; // month 1–12

const partFormats = new Map<string, Intl.DateTimeFormat>();

function partFormat(timeZone: string): Intl.DateTimeFormat {
  let format = partFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partFormats.set(timeZone, format);
  }
  return format;
}

/** The time zone if the runtime knows it, else "UTC". */
export function safeTimeZone(timeZone: string): string {
  try {
    partFormat(timeZone);
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** Wall-clock fields of an instant in a zone, as if they were UTC (ms, whole seconds). */
function wallClock(instant: number, timeZone: string): number {
  const fields: Record<string, number> = {};
  for (const p of partFormat(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") fields[p.type] = Number(p.value);
  }
  return Date.UTC(fields.year!, fields.month! - 1, fields.day!, fields.hour!, fields.minute!, fields.second!);
}

/** Offset of the zone from UTC at an instant, in ms (Bangkok: +7h). */
function offsetAt(instant: number, timeZone: string): number {
  const seconds = instant - (((instant % 1000) + 1000) % 1000);
  return wallClock(seconds, timeZone) - seconds;
}

/** The local calendar date of an instant. */
export function localDate(instant: number, timeZone: string): LocalDate {
  const d = new Date(wallClock(instant, timeZone));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** `YYYY-MM-DD` of an instant in a zone (the value of an `<input type="date">`). */
export function localDateKey(instant: number, timeZone: string): string {
  const { year, month, day } = localDate(instant, safeTimeZone(timeZone));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The first instant of a local calendar day. Month and day may overflow (month 13 = next January). */
export function startOfLocalDay(year: number, month: number, day: number, timeZone: string): number {
  const wall = Date.UTC(year, month - 1, day);
  const guess = wall - offsetAt(wall, timeZone);
  const offset = offsetAt(guess, timeZone);
  const second = wall - offset;
  // Across a DST change the first guess used the wrong offset. Keep the second guess only if it really
  // is midnight there; if midnight was skipped, the first guess is the first instant of the day.
  return second !== guess && offsetAt(second, timeZone) === offset ? second : guess;
}

/** The period containing `now` (or `offset` periods away) as UTC instants. */
export function periodRange(period: Period, options: PeriodOptions): TimeRange {
  if (period === "all") return null;
  const timeZone = safeTimeZone(options.timeZone);
  const offset = options.offset ?? 0;
  const { year, month, day } = localDate(options.now ?? Date.now(), timeZone);

  if (period === "year") {
    return { from: startOfLocalDay(year + offset, 1, 1, timeZone), to: startOfLocalDay(year + offset + 1, 1, 1, timeZone) };
  }
  if (period === "month") {
    return {
      from: startOfLocalDay(year, month + offset, 1, timeZone),
      to: startOfLocalDay(year, month + offset + 1, 1, timeZone),
    };
  }
  const isoWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7; // 1 = Monday … 7 = Sunday
  const weekStart = Number.isInteger(options.weekStart) && options.weekStart >= 1 && options.weekStart <= 7 ? options.weekStart : 1;
  const first = day - ((isoWeekday - weekStart + 7) % 7) + 7 * offset;
  return { from: startOfLocalDay(year, month, first, timeZone), to: startOfLocalDay(year, month, first + 7, timeZone) };
}

/** First day of the week for a locale (1 = Monday … 7 = Sunday), from CLDR where the runtime has it. */
export function weekStartFor(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay;
    if (firstDay && firstDay >= 1 && firstDay <= 7) return firstDay;
  } catch {
    // unknown locale tag: fall through
  }
  return 1;
}

/** Whether a timestamp (ISO string from the database) falls in the range. */
export function inRange(timestamp: string | null | undefined, range: TimeRange): boolean {
  if (!timestamp) return false;
  if (!range) return true;
  const t = Date.parse(timestamp);
  return t >= range.from && t < range.to;
}
