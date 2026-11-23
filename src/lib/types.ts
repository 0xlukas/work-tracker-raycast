/**
 * What WorkTracker's assistant tools return (WorkTracker/Sources/Assistant/AssistantTools.swift).
 * Days are `YYYY-MM-DD`, times `HH:MM` and moments `YYYY-MM-DD HH:MM`, all in Zurich
 * time. Hours are decimals (7.5 = 7h 30m). Only the fields the extension uses are listed.
 */

export interface Totals {
  worked: number;
  expected: number;
  /** worked − expected; positive is overtime. */
  balance: number;
}

export interface VacationBudget {
  year: number;
  entitlement_days: number;
  carried_over_days: number;
  used_days: number;
  remaining_days: number;
}

export type TimerState =
  { running: false } | { running: true; project: string | null; started: string; elapsed_hours: number };

export interface Overview {
  now: string;
  weekday: string;
  tracking_start: string;
  today: Totals;
  this_week: Totals;
  this_month: Totals;
  this_year_to_date: Totals;
  this_year_expected_in_total: number;
  all_time_balance: number;
  opening_balance: number;
  vacation: VacationBudget;
  days_without_entries: { count: number; most_recent: string[] };
  timer: TimerState;
  sync?: { enabled: boolean; last_sync?: string; paused_until_answered_in_app?: string; error?: string };
}

/** How a tool names an absence category: built-ins by key, custom ones by name and id. */
export interface CategoryReference {
  category: string;
  category_name?: string;
  category_id?: string;
}

export interface SummaryDay extends Totals {
  date: string;
  weekday: string;
  holiday?: string;
  absence?: CategoryReference & { days: number; over_vacation_allowance?: boolean };
  missing_entries?: boolean;
}

export interface SummaryChunk extends Totals {
  from: string;
  to: string;
  week_of?: string;
  month?: string;
}

export interface Summary extends Partial<Totals> {
  from: string;
  to: string;
  note?: string;
  working_days?: number;
  public_holidays?: number;
  half_day_holidays?: number;
  absence_days?: (CategoryReference & { days: number })[];
  projects?: { project: string; hours: number }[];
  days?: SummaryDay[];
  weeks?: SummaryChunk[];
  months?: SummaryChunk[];
}

export interface Entry {
  id: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  project: string | null;
  note?: string;
}

export interface EntryList {
  from: string;
  to: string;
  count: number;
  total_hours: number;
  entries: Entry[];
  note?: string;
}

export type PaletteColor =
  "blue" | "green" | "orange" | "purple" | "pink" | "teal" | "indigo" | "red" | "mint" | "cyan";

export interface Project {
  id: string;
  name: string;
  color: PaletteColor;
  archived: boolean;
  entries: number;
  total_hours: number;
  last_worked?: string;
  timer_running?: boolean;
}

export interface AbsenceCategory extends CategoryReference {
  rule: "reduce_hours" | "vacation_allowance" | "unchanged";
  built_in: boolean;
  archived?: boolean;
  color?: PaletteColor;
}

export interface Absence extends CategoryReference {
  date: string;
  weekday: string;
  half_day: boolean;
  counted_days: number;
  over_vacation_allowance?: boolean;
}

export interface Vacation extends VacationBudget {
  days: (CategoryReference & { date: string; days: number; over_allowance?: boolean })[];
}

export interface MissingDay {
  date: string;
  weekday: string;
  expected: number;
}

export type CallLength = "short" | "medium" | "long";

export interface Call {
  id: string;
  date: string;
  weekday: string;
  time: string;
  caller: string;
  topic: string | null;
  department: string | null;
  length: CallLength;
  solved_by: "me" | "caller";
  note?: string;
}

export interface CallSummary {
  calls: number;
  solved_by_me: number;
  departments: string[];
}
