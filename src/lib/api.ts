import { resolveConnection } from "./config";
import { callTool } from "./mcp";
import type {
  Absence,
  AbsenceCategory,
  Call,
  CallLength,
  CallSummary,
  Entry,
  EntryList,
  MissingDay,
  Overview,
  Project,
  Summary,
  TimerState,
  Vacation,
} from "./types";

/**
 * WorkTracker's tools, typed. Everything goes through the app's assistant server, so the
 * app's rules apply (no overlapping entries, archived projects take no entries, …), the
 * numbers are the app's own and changes sync to the other Macs.
 */
async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return callTool<T>(await resolveConnection(), name, args);
}

/** A tool that changes data. */
async function change<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return callTool<T>(await resolveConnection(), name, args, { write: true });
}

// Reading

export const getOverview = () => call<Overview>("get_overview");

export const getSummary = (from: string, to: string, breakdown: "none" | "day" | "week" | "month" = "none") =>
  call<Summary>("get_summary", { from, to, breakdown });

export const listEntries = (from: string, to: string = from) => call<EntryList>("list_entries", { from, to });

export const listProjects = (includeArchived = false) =>
  call<{ projects: Project[] }>("list_projects", { include_archived: includeArchived }).then((r) => r.projects);

export const listAbsences = (from: string, to: string) =>
  call<{ absences: Absence[] }>("list_absences", { from, to }).then((r) => r.absences);

export const listAbsenceCategories = () =>
  call<{ categories: AbsenceCategory[] }>("list_absence_categories").then((r) => r.categories);

export const getVacation = (year: number) => call<Vacation>("get_vacation", { year });

export const listDaysWithoutEntries = () =>
  call<{ count: number; days: MissingDay[] }>("list_days_without_entries").then((r) => r.days);

/** Calls in a range, oldest first; at most `limit`, the oldest ones (`count` has them all). */
export const listCalls = (from: string, to: string, limit = 2000) =>
  call<{ count: number; calls: Call[] }>("list_calls", { from, to, limit });

export const getCallSummary = (from: string, to: string = from) => call<CallSummary>("get_call_summary", { from, to });

// Time entries

export interface NewEntry {
  date: string;
  start: string;
  end: string;
  project: string;
  note?: string;
}

export const addEntry = (entry: NewEntry) =>
  change<{ added: Entry[]; total_hours: number }>("add_entries", { entries: [entry] }).then((r) => r.added[0]);

export const updateEntry = (id: string, changes: Partial<NewEntry>) =>
  change<{ before: Entry; after: Entry }>("update_entry", { id, ...changes }).then((r) => r.after);

export const deleteEntries = (ids: string[]) => change<{ deleted: Entry[] }>("delete_entries", { ids });

export const copyEntries = (fromDate: string, toDate: string) =>
  change<{ copied: number; skipped_because_of_overlaps: number }>("copy_entries", {
    from_date: fromDate,
    to_date: toDate,
  });

// Absences

export const setAbsences = (from: string, to: string, category: string, halfDay: boolean) =>
  change<{ days: string[]; skipped?: { date: string; reason: string }[] }>("set_absences", {
    from,
    to,
    category,
    half_day: halfDay,
  });

export const removeAbsences = (from: string, to: string = from) =>
  change<{ removed: Absence[] }>("remove_absences", { from, to });

// Timer

/** `at`: `HH:MM` today or `YYYY-MM-DD HH:MM`; now when left out. */
export const startTimer = (project: string, at?: string) =>
  change<{ message: string; timer: TimerState }>("start_timer", at ? { project, at } : { project });

export const stopTimer = (at?: string) => change<{ saved: Entry[]; note?: string }>("stop_timer", at ? { at } : {});

export const discardTimer = () => change<{ discarded: { project: string | null; started: string } }>("discard_timer");

// Calls

export interface NewCall {
  caller: string;
  topic?: string;
  department?: string;
  length: CallLength;
  solved_by_me: boolean;
  note?: string;
  at?: string;
}

export const logCall = (newCall: NewCall) => change<Call>("log_call", { ...newCall });

export const deleteCalls = (ids: string[]) => change<{ deleted: Call[] }>("delete_calls", { ids });
