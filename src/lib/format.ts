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

/** A date picker's moment as `YYYY-MM-DD HH:MM` (the Mac's clock). */
export function momentFromPicker(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${dayFromPicker(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
 * A typed time as `HH:MM`: accepts `9`, `930`, `0930`, `9:30`, `9.30` and `9h30`.
 * `24:00` only when `allowEndOfDay` (an entry's end). Undefined when it isn't a time.
 */
export function parseTimeInput(text: string, allowEndOfDay = false): string | undefined {
  const match = text.trim().match(/^(\d{1,2})(?:[:.h]?(\d{2}))?$/i);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (minutes > 59) return undefined;
  if (hours > 24 || (hours === 24 && (!allowEndOfDay || minutes > 0))) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
