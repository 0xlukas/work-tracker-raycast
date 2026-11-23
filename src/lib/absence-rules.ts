import { formatDay } from "./format";
import type { Absence } from "./types";

export const nameOf = (absence: Absence) => absence.category_name ?? absence.category;
const keyOf = (absence: Absence) => absence.category_id ?? absence.category;

/** What set_absences would overwrite: another category, or full instead of half days (or the other way). */
export function replacedAbsences(existing: Absence[], category: string, halfDay: boolean): Absence[] {
  return existing.filter((absence) => keyOf(absence) !== category || absence.half_day !== halfDay);
}

/** The skipped days worth naming (public holidays), and how many others (weekends, days off). */
export function describeSkipped(skipped: { date: string; reason: string }[] = []): string | undefined {
  const holidays = skipped.filter((day) => day.reason.startsWith("public holiday"));
  const others = skipped.length - holidays.length;
  const parts = holidays.map(
    (day) => `${formatDay(day.date, "short")} (${day.reason.replace(/^public holiday \((.*)\)$/, "$1")})`,
  );
  if (others > 0) parts.push(`+${others} non-working ${others === 1 ? "day" : "days"}`);
  return parts.length > 0 ? `Skipped ${parts.join(", ")}` : undefined;
}
