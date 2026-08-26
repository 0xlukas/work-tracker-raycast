import { startOfDayZurich, isWeekendZurich } from "./dates";
import { holidayLookup, holidayNameLookup } from "./holidays";
import type { AbsenceEntry, DaySummary, HolidayType, WorkSegment } from "./types";

/**
 * Port of WorkHoursCalculator.swift.
 * Calculates expected hours, actual hours, and balance for work tracking.
 */
export class WorkHoursCalculator {
  private holidays: Map<number, HolidayType>;
  private holidayNames: Map<number, string>;

  constructor(years: number[] = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]) {
    this.holidays = holidayLookup(years);
    this.holidayNames = holidayNameLookup(years);
  }

  /**
   * Classify a single day: weekend, holiday, absence (vacation/sick), or regular workday.
   * absenceLookup: Map of start-of-day-Zurich timestamp → absence entry.
   */
  classify(date: Date, absenceLookup: Map<number, AbsenceEntry>): DaySummary {
    const normalized = startOfDayZurich(date);
    const key = normalized.getTime();

    const day = (over: Partial<DaySummary>): DaySummary => ({
      date: normalized,
      expectedHours: 0,
      isHoliday: false,
      holidayName: null,
      isHalfDayHoliday: false,
      isVacation: false,
      isHalfDayVacation: false,
      isSick: false,
      isHalfDaySick: false,
      isWeekend: false,
      ...over,
    });

    if (isWeekendZurich(normalized)) {
      return day({ isWeekend: true });
    }

    const absence = absenceLookup.get(key);
    const holidayType = this.holidays.get(key);
    const holidayName = this.holidayNames.get(key) ?? null;

    // Full-day holiday: always 0h, absence irrelevant
    if (holidayType === "fullDay") {
      return day({ isHoliday: true, holidayName });
    }

    // Sick day on a half-day holiday: sick replaces the working half (0h expected)
    if (absence?.type === "sick" && holidayType === "halfDay") {
      return day({
        isHoliday: true,
        holidayName,
        isHalfDayHoliday: true,
        isSick: true,
        isHalfDaySick: absence.isHalfDay,
      });
    }

    // Half-day sick on a regular day: 4h expected (work half, sick half)
    if (absence?.type === "sick" && absence.isHalfDay) {
      return day({ expectedHours: 4, isSick: true, isHalfDaySick: true });
    }

    // Full-day sick on a regular day: 0h expected
    if (absence?.type === "sick") {
      return day({ isSick: true });
    }

    const isVacation = absence?.type === "vacation";
    const isHalfDayVacation = isVacation && absence.isHalfDay;

    // Vacation on a half-day holiday
    if (isVacation && holidayType === "halfDay") {
      return day({ isHoliday: true, holidayName, isHalfDayHoliday: true, isVacation: true, isHalfDayVacation });
    }

    // Half-day vacation on a regular day: 4h expected (work half, vacation half)
    if (isHalfDayVacation) {
      return day({ expectedHours: 4, isVacation: true, isHalfDayVacation: true });
    }

    // Full-day vacation on a regular day: 0h expected
    if (isVacation) {
      return day({ isVacation: true });
    }

    // Half-day holiday without absence: 4h expected
    if (holidayType === "halfDay") {
      return day({ expectedHours: 4, isHoliday: true, holidayName, isHalfDayHoliday: true });
    }

    // Regular workday: 8h expected
    return day({ expectedHours: 8 });
  }

  todaySummary(
    absenceLookup: Map<number, AbsenceEntry>,
    segments: WorkSegment[],
  ): { daySummary: DaySummary; todayHours: number } {
    const today = startOfDayZurich(new Date());
    const todayKey = today.getTime();
    const daySummary = this.classify(new Date(), absenceLookup);

    const todayHours = segments
      .filter((seg) => startOfDayZurich(seg.date).getTime() === todayKey)
      .reduce((sum, seg) => sum + seg.durationHours, 0);

    return { daySummary, todayHours };
  }
}

/**
 * e.g. `8h 05m`. Port of TimeFormatting.hours — rounds to whole minutes first, so
 * 7.999h renders as "8h 00m" rather than "7h 60m".
 */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const sign = hours < 0 && totalMinutes !== 0 ? "-" : "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
}

/** e.g. `1` or `1.5`. Port of TimeFormatting.days. */
export function formatDays(days: number): string {
  return days === Math.round(days) ? `${Math.round(days)}` : days.toFixed(1);
}

/** Human label for a classified day's absence/holiday state, or null for a plain workday. */
export function daySummaryLabel(summary: DaySummary): string | null {
  const parts: string[] = [];
  if (summary.isSick) parts.push(summary.isHalfDaySick ? "Half-day sick" : "Sick");
  if (summary.isVacation) parts.push(summary.isHalfDayVacation ? "Half-day vacation" : "Vacation");
  if (summary.holidayName) parts.push(summary.holidayName);
  else if (summary.isWeekend) parts.push("Weekend");
  return parts.length > 0 ? parts.join(" • ") : null;
}
