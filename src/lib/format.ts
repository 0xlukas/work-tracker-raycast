/**
 * Formatting and day arithmetic. WorkTracker speaks in Zurich days (`YYYY-MM-DD`) and
 * times (`HH:MM`); these helpers work on those strings, so the Mac's own time zone only
 * matters where a Raycast date picker hands over a `Date`.
 */

const ZURICH = "Europe/Zurich";

/** `8h 05m`, like WorkTracker. Rounds to whole minutes. */
export function formatHours(hours: number): string {
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 && minutes > 0 ? "-" : ""}${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** `+2h 30m` / `-0h 45m`, like WorkTracker's balances. */
export function formatBalance(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${minutes < 0 ? "-" : "+"}${formatHours(Math.abs(hours))}`;
}

/** `1`, `1.5`. */
export function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

/** `1 day`, `2.5 days`. */
export function dayCount(days: number): string {
  return days === 1 ? "1 day" : `${formatDays(days)} days`;
}

/** Today in Zurich, `YYYY-MM-DD`. */
export function zurichToday(now: Date = new Date()): string {
  return zurichParts(now).day;
}

/** The Zurich day and time of a moment. */
export function zurichParts(moment: Date): { day: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZURICH,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function utcDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = utcDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return dayOf(date);
}

/** Monday of the day's week. */
export function startOfWeek(day: string): string {
  const weekday = (utcDate(day).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000);
}

/** A date picker's day (the Mac's calendar), `YYYY-MM-DD`. */
export function dayFromPicker(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A day as a date picker expects it: local midnight. */
export function pickerDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/** A date picker's moment as WorkTracker takes it: `YYYY-MM-DD HH:MM` in Zurich time. */
export function momentFromPicker(date: Date): string {
  const { day, time } = zurichParts(date);
  return `${day} ${time}`;
}

/** A tool's `YYYY-MM-DD HH:MM`: just the time today, with the day otherwise. */
export function shortMoment(moment: string, today: string = zurichToday()): string {
  const day = moment.slice(0, 10);
  const time = moment.slice(11);
  return day === today ? time : `${formatDay(day, day.slice(0, 4) === today.slice(0, 4) ? "short" : "medium")} ${time}`;
}

/** `Monday, 23 November 2026` (long) or `Mon 23 Nov` (short). */
export function formatDay(day: string, style: "long" | "short" | "medium" = "long"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "medium"
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { weekday: "short", day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(utcDate(day));
}

/** `Today`, `Yesterday` or `Mon 23 Nov`. */
export function relativeDay(day: string, today: string = zurichToday()): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  if (day === addDays(today, 1)) return "Tomorrow";
  return formatDay(day, day.slice(0, 4) === today.slice(0, 4) ? "short" : "medium");
}

/**
 * A typed time as `HH:MM`, read exactly like WorkTracker's `TimeField.parse`: one or two
 * digits are the hour (`8`, `08`), three are H:MM (`810`), four or more end in HHMM
 * (`0810`), and any separator splits hour and minutes (`8:10`, `8.10`, `8 10`, `8h10`).
 * `24:00` only when `allowEndOfDay` (an entry's end). Undefined when it isn't a time.
 */
export function parseTimeInput(text: string, allowEndOfDay = false): string | undefined {
  const trimmed = text.trim();
  const number = (digits: string) => (/^\d+$/.test(digits) ? Number(digits) : NaN);
  let hour: number;
  let minute: number;
  const separator = [...trimmed].find((character) => !/\d/.test(character));
  if (separator !== undefined) {
    const parts = trimmed.split(separator);
    hour = number(parts[0]);
    minute = parts.length > 1 ? number(parts[1]) : 0;
  } else if (trimmed.length === 1 || trimmed.length === 2) {
    hour = number(trimmed);
    minute = 0;
  } else if (trimmed.length === 3) {
    hour = number(trimmed.slice(0, 1));
    minute = number(trimmed.slice(1));
  } else if (trimmed.length >= 4) {
    const last4 = trimmed.slice(-4);
    hour = number(last4.slice(0, 2));
    minute = number(last4.slice(2));
  } else {
    return undefined;
  }
  if (allowEndOfDay && hour === 24 && minute === 0) return "24:00";
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Minutes since midnight of `HH:MM`. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeOf(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** The current Zurich time rounded down to `step` minutes, `HH:MM`. */
export function nowRounded(step = 5, now: Date = new Date()): string {
  const minutes = minutesOf(zurichParts(now).time);
  return timeOf(minutes - (minutes % step));
}
