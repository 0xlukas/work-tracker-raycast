import { getZurichComponents, makeDateZurich } from "./dates";

/**
 * Port of TimeField.format/parse from TimeField.swift.
 * A time of day is typed in one go as `HHMM` (`0930`), as `HMM` (`930`), as one or
 * two digits for the hour (`9`, `09`), or with any separator (`9:30`, `9.30`, `9 30`).
 */

/** e.g. `08:10` — the time of day in Zurich. */
export function formatTimeOfDay(time: Date): string {
  return new Intl.DateTimeFormat("en-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(time);
}

/** Strict integer parse — rejects `""`, `"1a"`, `"+1"`. */
function strictInt(s: string): number {
  return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

/**
 * Parse compact (`0930`, `930`, `9`) or separated (`9:30`) input into a Date on `day`,
 * keeping `day`'s calendar date and setting only the time of day. Returns null for
 * anything that isn't a valid 24h time.
 */
export function parseTimeInput(input: string, day: Date): Date | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let hour: number;
  let minute: number;

  const separator = [...trimmed].find((c) => !/\d/.test(c));
  if (separator !== undefined) {
    // Explicit separator: "9:30", "9.30", "9 30"
    const parts = trimmed.split(separator);
    hour = strictInt(parts[0]);
    minute = parts.length > 1 ? strictInt(parts[1]) : 0;
  } else {
    switch (trimmed.length) {
      case 1:
      case 2: // "9" / "09" → hour only
        hour = strictInt(trimmed);
        minute = 0;
        break;
      case 3: // "930" → H:MM
        hour = strictInt(trimmed.slice(0, 1));
        minute = strictInt(trimmed.slice(1));
        break;
      default: {
        // "0930" (or longer) → last 4 digits as HHMM
        const last4 = trimmed.slice(-4);
        hour = strictInt(last4.slice(0, 2));
        minute = strictInt(last4.slice(2));
        break;
      }
    }
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const { year, month, day: dayOfMonth } = getZurichComponents(day);
  return makeDateZurich(year, month, dayOfMonth, hour, minute);
}
