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

export interface VacationDay {
  id: number;
  date: Date;
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
}

export interface Quote {
  text: string;
  thinker: string;
  source: string | null;
}
