/**
 * NSDate reference: seconds since 2001-01-01 00:00:00 UTC.
 * Offset from Unix epoch (1970-01-01) = 978307200 seconds.
 */
const NSDATE_OFFSET = 978307200;

export function nsTimestampToDate(ts: number): Date {
  return new Date((ts + NSDATE_OFFSET) * 1000);
}

export function dateToNSTimestamp(d: Date): number {
  return d.getTime() / 1000 - NSDATE_OFFSET;
}

/**
 * Get the start of day in Europe/Zurich timezone for a given date.
 */
export function startOfDayZurich(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value);
  const day = parseInt(parts.find((p) => p.type === "day")!.value);

  // Create a date at midnight Zurich by trying UTC midnight and adjusting
  // for the timezone offset at that date
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const zurichOffset = getZurichOffsetMinutes(probe);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + zurichOffset * 60000);
}

/**
 * Get the UTC offset in minutes for Europe/Zurich at a given moment.
 * Returns a positive number for UTC+X (e.g. 60 for CET, 120 for CEST).
 * We negate it because we need to subtract it to go from local to UTC.
 */
function getZurichOffsetMinutes(date: Date): number {
  const utcStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const zurichStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const parseFormatted = (s: string): number => {
    // Format: MM/DD/YYYY, HH:MM:SS
    const [datePart, timePart] = s.split(", ");
    const [m, d, y] = datePart.split("/").map(Number);
    const [h, min, sec] = timePart.split(":").map(Number);
    return Date.UTC(y, m - 1, d, h, min, sec);
  };

  const utcMs = parseFormatted(utcStr);
  const zurichMs = parseFormatted(zurichStr);
  // Offset = Zurich - UTC (positive means Zurich is ahead)
  // We return negative because to convert local→UTC we subtract the offset
  return -((zurichMs - utcMs) / 60000);
}

/**
 * Check if a date falls on a weekend in Zurich timezone.
 */
export function isWeekendZurich(date: Date): boolean {
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    weekday: "short",
  }).format(date);
  return dayOfWeek === "Sat" || dayOfWeek === "Sun";
}

/**
 * Get Zurich date components for a Date.
 */
export function getZurichComponents(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value),
    day: parseInt(parts.find((p) => p.type === "day")!.value),
  };
}

/**
 * Create a Date at a specific time in Zurich timezone.
 */
export function makeDateZurich(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  // Start with a rough UTC estimate, then adjust for timezone
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = getZurichOffsetMinutes(probe);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) + offset * 60000);
}

/**
 * Check if two dates are the same calendar day in Zurich timezone.
 */
export function isSameDayZurich(a: Date, b: Date): boolean {
  const ca = getZurichComponents(a);
  const cb = getZurichComponents(b);
  return ca.year === cb.year && ca.month === cb.month && ca.day === cb.day;
}

/**
 * Get all dates from start to end (inclusive), stepping by 1 day, in Zurich timezone.
 */
export function daysThroughZurich(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let current = startOfDayZurich(start);
  const endNorm = startOfDayZurich(end);
  while (current.getTime() <= endNorm.getTime()) {
    dates.push(current);
    // Add 25 hours to ensure we cross the day boundary even with DST
    current = startOfDayZurich(new Date(current.getTime() + 25 * 3600000));
  }
  return dates;
}

/**
 * Get the weekday (1=Sunday, 2=Monday, ..., 7=Saturday) in Zurich timezone.
 * Matches Swift's Calendar.component(.weekday).
 */
export function weekdayZurich(date: Date): number {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
  return map[day];
}

/**
 * Get the number of days in a month for a given year.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
