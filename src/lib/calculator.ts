import { startOfDayZurich, isWeekendZurich, daysThroughZurich, getZurichComponents } from "./dates";
import { holidayLookup, holidayNameLookup } from "./holidays";
import type { DaySummary, PeriodSummary, HolidayType, WorkSegment } from "./types";

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
   * Classify a single day: weekend, holiday, vacation, or regular workday.
   * vacationLookup: Map of date timestamp → isHalfDay (true = half-day vacation)
   */
  classify(date: Date, vacationLookup: Map<number, boolean>): DaySummary {
    const normalized = startOfDayZurich(date);
    const key = normalized.getTime();

    if (isWeekendZurich(normalized)) {
      return {
        date: normalized,
        expectedHours: 0,
        isHoliday: false,
        holidayName: null,
        isHalfDayHoliday: false,
        isVacation: false,
        isHalfDayVacation: false,
        isWeekend: true,
      };
    }

    const vacationEntry = vacationLookup.get(key); // undefined = no vacation, false = full, true = half
    const isVacation = vacationEntry !== undefined;
    const isHalfDayVacation = vacationEntry === true;
    const holidayType = this.holidays.get(key);
    const holidayName = this.holidayNames.get(key) ?? null;

    // Full-day holiday: always 0h, vacation irrelevant
    if (holidayType === "fullDay") {
      return {
        date: normalized,
        expectedHours: 0,
        isHoliday: true,
        holidayName,
        isHalfDayHoliday: false,
        isVacation: false,
        isHalfDayVacation: false,
        isWeekend: false,
      };
    }

    // Vacation on a half-day holiday
    if (isVacation && holidayType === "halfDay") {
      return {
        date: normalized,
        expectedHours: 0,
        isHoliday: true,
        holidayName,
        isHalfDayHoliday: true,
        isVacation: true,
        isHalfDayVacation,
        isWeekend: false,
      };
    }

    // Half-day vacation on a regular day: 4h expected
    if (isHalfDayVacation) {
      return {
        date: normalized,
        expectedHours: 4,
        isHoliday: false,
        holidayName: null,
        isHalfDayHoliday: false,
        isVacation: true,
        isHalfDayVacation: true,
        isWeekend: false,
      };
    }

    // Full-day vacation on a regular day: 0h expected
    if (isVacation) {
      return {
        date: normalized,
        expectedHours: 0,
        isHoliday: false,
        holidayName: null,
        isHalfDayHoliday: false,
        isVacation: true,
        isHalfDayVacation: false,
        isWeekend: false,
      };
    }

    // Half-day holiday without vacation: 4h expected
    if (holidayType === "halfDay") {
      return {
        date: normalized,
        expectedHours: 4,
        isHoliday: true,
        holidayName,
        isHalfDayHoliday: true,
        isVacation: false,
        isHalfDayVacation: false,
        isWeekend: false,
      };
    }

    // Regular workday: 8h expected
    return {
      date: normalized,
      expectedHours: 8,
      isHoliday: false,
      holidayName: null,
      isHalfDayHoliday: false,
      isVacation: false,
      isHalfDayVacation: false,
      isWeekend: false,
    };
  }

  periodSummary(
    from: Date,
    to: Date,
    vacationLookup: Map<number, boolean>,
    segments: WorkSegment[],
  ): PeriodSummary {
    const days = daysThroughZurich(from, to);
    const fromNorm = startOfDayZurich(from).getTime();
    const toNorm = startOfDayZurich(to).getTime();

    let expectedHours = 0;
    let workingDays = 0;
    let holidayDays = 0;
    let halfDayHolidays = 0;
    let vacationDayCount = 0;

    for (const day of days) {
      const summary = this.classify(day, vacationLookup);
      expectedHours += summary.expectedHours;

      if (summary.isWeekend) continue;

      // Vacation on a half-day holiday: counts as 0.5 vacation + 1 half-day holiday
      if (summary.isVacation && summary.isHalfDayHoliday) {
        vacationDayCount += 0.5;
        halfDayHolidays += 1;
        continue;
      }

      // Half-day vacation on regular day: counts as 0.5
      if (summary.isVacation && summary.isHalfDayVacation) {
        vacationDayCount += 0.5;
        workingDays += 1;
        continue;
      }

      if (summary.isVacation) {
        vacationDayCount += 1;
        continue;
      }
      if (summary.isHoliday && !summary.isHalfDayHoliday) {
        holidayDays += 1;
        continue;
      }
      if (summary.isHalfDayHoliday) {
        halfDayHolidays += 1;
      }
      workingDays += 1;
    }

    // Extra vacation beyond 25 days adds to expected hours (unpaid leave penalty)
    if (vacationDayCount > 25) {
      const extraDays = vacationDayCount - 25;
      expectedHours += extraDays * 8;
    }

    const actualHours = segments
      .filter((seg) => {
        const d = startOfDayZurich(seg.date).getTime();
        return d >= fromNorm && d <= toNorm;
      })
      .reduce((sum, seg) => sum + seg.durationHours, 0);

    return {
      expectedHours,
      actualHours,
      balance: actualHours - expectedHours,
      workingDays,
      holidayDays,
      halfDayHolidays,
      vacationDays: vacationDayCount,
    };
  }

  todaySummary(
    vacationLookup: Map<number, boolean>,
    segments: WorkSegment[],
  ): { daySummary: DaySummary; todayHours: number } {
    const today = startOfDayZurich(new Date());
    const todayKey = today.getTime();
    const daySummary = this.classify(new Date(), vacationLookup);

    const todayHours = segments
      .filter((seg) => startOfDayZurich(seg.date).getTime() === todayKey)
      .reduce((sum, seg) => sum + seg.durationHours, 0);

    return { daySummary, todayHours };
  }
}

export function formatHours(hours: number): string {
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? "-" : "";
  return `${sign}${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatBalance(hours: number): string {
  const sign = hours >= 0 ? "+" : "";
  return `${sign}${formatHours(hours)}`;
}
