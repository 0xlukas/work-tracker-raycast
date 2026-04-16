import { startOfDayZurich, isWeekendZurich } from "./dates";
import { holidayLookup, holidayNameLookup } from "./holidays";
import type { DaySummary, HolidayType, WorkSegment } from "./types";

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

