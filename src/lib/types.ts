export interface WorkSegment {
  id: number;
  date: Date;
  startTime: Date;
  endTime: Date;
  durationHours: number;
  projectId: number | null;
  projectName: string | null;
}

export interface Project {
  id: number;
  name: string;
  createdAt: Date;
}

/** Mirrors AbsenceType in SchemaMigration.swift (stored in ZVACATIONDAY.ZTYPE). */
export type AbsenceType = "vacation" | "sick";

export interface VacationDay {
  id: number;
  date: Date;
  isHalfDay: boolean;
  /** Legacy rows have no stored type; they resolve to "vacation" (cf. `resolvedType`). */
  type: AbsenceType;
}

/** Port of AbsenceEntry in WorkHoursCalculator.swift. */
export interface AbsenceEntry {
  type: AbsenceType;
  isHalfDay: boolean;
}

export type HolidayType = "fullDay" | "halfDay";

export interface Holiday {
  name: string;
  date: Date;
  type: HolidayType;
}

export interface DaySummary {
  date: Date;
  expectedHours: number;
  isHoliday: boolean;
  holidayName: string | null;
  isHalfDayHoliday: boolean;
  isVacation: boolean;
  isHalfDayVacation: boolean;
  isSick: boolean;
  isHalfDaySick: boolean;
  isWeekend: boolean;
}

export interface PeriodSummary {
  expectedHours: number;
  actualHours: number;
  balance: number;
  workingDays: number;
  holidayDays: number;
  halfDayHolidays: number;
  vacationDays: number;
  sickDays: number;
}

export interface Quote {
  text: string;
  thinker: string;
  source: string | null;
}
