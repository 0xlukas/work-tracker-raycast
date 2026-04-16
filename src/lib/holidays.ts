import { makeDateZurich, startOfDayZurich, isWeekendZurich, isSameDayZurich } from "./dates";
import type { Holiday, HolidayType } from "./types";

/**
 * Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 * Port of ZurichHolidays.swift.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDateZurich(year, month, day);
}

/**
 * Returns the nth occurrence of a weekday in a given month/year.
 * weekday: 0=Sunday, 1=Monday, ..., 6=Saturday (JS convention).
 */
function nthWeekday(nth: number, weekday: number, month: number, year: number): Date {
  // Start from the 1st of the month
  let date = makeDateZurich(year, month, 1);
  const dayOfWeek = date.getUTCDay !== undefined ? new Date(date).getDay() : 0;

  // Find the first occurrence of the target weekday
  // We need to get the day of week in Zurich timezone
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", weekday: "short" });
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const targetName = weekdayNames[weekday];

  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const candidate = makeDateZurich(year, month, d);
    if (fmt.format(candidate) === targetName) {
      count++;
      if (count === nth) {
        return candidate;
      }
    }
  }
  throw new Error(`Could not find ${nth}th ${targetName} in ${year}-${month}`);
}

function addDays(date: Date, days: number): Date {
  return startOfDayZurich(new Date(date.getTime() + days * 86400000 + 3600000));
}

/**
 * Sechseläuten: 3rd Monday of April.
 * If it coincides with Easter Monday, moves to 4th Monday.
 */
function sechselaeuten(year: number, easterMonday: Date): Date {
  const thirdMonday = nthWeekday(3, 1, 4, year); // Monday = 1 in JS
  if (isSameDayZurich(thirdMonday, easterMonday)) {
    return nthWeekday(4, 1, 4, year);
  }
  return thirdMonday;
}

/**
 * Knabenschiessen: Monday after the 2nd Sunday of September.
 */
function knabenschiessen(year: number): Date {
  const secondSunday = nthWeekday(2, 0, 9, year); // Sunday = 0 in JS
  return addDays(secondSunday, 1);
}

/**
 * Returns all Zurich public holidays for a given year.
 */
export function holidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const easterMonday = addDays(easter, 1);

  return [
    // Fixed full-day holidays
    { name: "Neujahr", date: makeDateZurich(year, 1, 1), type: "fullDay" },
    { name: "Berchtoldstag", date: makeDateZurich(year, 1, 2), type: "fullDay" },
    { name: "Tag der Arbeit", date: makeDateZurich(year, 5, 1), type: "fullDay" },
    { name: "Bundesfeier", date: makeDateZurich(year, 8, 1), type: "fullDay" },
    { name: "Heiligabend", date: makeDateZurich(year, 12, 24), type: "fullDay" },
    { name: "Weihnachten", date: makeDateZurich(year, 12, 25), type: "fullDay" },
    { name: "Stephanstag", date: makeDateZurich(year, 12, 26), type: "fullDay" },

    // Easter-based full-day holidays
    { name: "Karfreitag", date: addDays(easter, -2), type: "fullDay" },
    { name: "Ostermontag", date: easterMonday, type: "fullDay" },
    { name: "Auffahrt", date: addDays(easter, 39), type: "fullDay" },
    { name: "Pfingstmontag", date: addDays(easter, 50), type: "fullDay" },

    // Half-day holidays
    { name: "Sechseläuten", date: sechselaeuten(year, easterMonday), type: "halfDay" },
    { name: "Knabenschiessen", date: knabenschiessen(year), type: "halfDay" },
    { name: "Silvester", date: makeDateZurich(year, 12, 31), type: "halfDay" },
  ];
}

/**
 * Build a holiday lookup: date timestamp → HolidayType.
 * Only includes holidays that fall on weekdays.
 */
export function holidayLookup(years: number[]): Map<number, HolidayType> {
  const lookup = new Map<number, HolidayType>();
  for (const year of years) {
    for (const h of holidays(year)) {
      const normalized = startOfDayZurich(h.date);
      if (!isWeekendZurich(normalized)) {
        lookup.set(normalized.getTime(), h.type);
      }
    }
  }
  return lookup;
}

/**
 * Build a holiday name lookup: date timestamp → holiday name.
 * Only includes holidays that fall on weekdays.
 */
export function holidayNameLookup(years: number[]): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const year of years) {
    for (const h of holidays(year)) {
      const normalized = startOfDayZurich(h.date);
      if (!isWeekendZurich(normalized)) {
        lookup.set(normalized.getTime(), h.name);
      }
    }
  }
  return lookup;
}
