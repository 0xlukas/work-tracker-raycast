/**
 * Runs the extension's calls against a running WorkTracker **test build** (never the real
 * app): set WORKTRACKER_TEST_PORT and WORKTRACKER_TEST_KEY to its port and key. See CLAUDE.md.
 * Everything it adds, it removes again.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { replacedAbsences } from "../src/lib/absence-rules";
import * as api from "../src/lib/api";
import { recentCalls } from "../src/lib/calls";
import { WORKTRACKER_BUNDLE_ID } from "../src/lib/config";
import { DEFAULT_PORT, WorkTrackerError } from "../src/lib/mcp";

const port = Number(process.env.WORKTRACKER_TEST_PORT ?? 0);
const key = process.env.WORKTRACKER_TEST_KEY ?? "";

function realKey(): string {
  try {
    return execFileSync("/usr/bin/defaults", ["read", WORKTRACKER_BUNDLE_ID, "assistantServerToken"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const skip = !port || !key ? "set WORKTRACKER_TEST_PORT and WORKTRACKER_TEST_KEY to run against a test build" : false;
if (!skip && (port === DEFAULT_PORT || key === realKey())) {
  throw new Error("Refusing to run the live tests against the real WorkTracker (default port or its key).");
}

test("reads match the app's shapes", { skip }, async () => {
  const overview = await api.getOverview();
  assert.match(overview.now, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  for (const totals of [overview.today, overview.this_week, overview.this_month, overview.this_year_to_date]) {
    assert.equal(typeof totals.worked, "number");
    assert.equal(typeof totals.expected, "number");
    assert.equal(typeof totals.balance, "number");
  }
  assert.equal(typeof overview.vacation.remaining_days, "number");
  assert.equal(typeof overview.days_without_entries.count, "number");
  assert.equal(typeof overview.timer.running, "boolean");

  const today = overview.now.slice(0, 10);
  const summary = await api.getSummary(today, today, "day");
  assert.equal(summary.days?.length ?? 0, summary.days ? summary.days.length : 0);
  const projects = await api.listProjects(true);
  assert.ok(projects.length > 0, "the test build needs a project");
  assert.ok(projects.every((p) => typeof p.archived === "boolean" && typeof p.color === "string"));
  assert.ok((await api.listAbsenceCategories()).some((c) => c.category === "vacation"));
  const vacation = await api.getVacation(Number(today.slice(0, 4)));
  assert.equal(vacation.remaining_days, overview.vacation.remaining_days);
  assert.ok(Array.isArray(await api.listDaysWithoutEntries()));
  assert.ok(Array.isArray((await api.getCallSummary(today)).departments));
});

test("add, edit and delete an entry; the app's rules apply", { skip }, async () => {
  const project = (await api.listProjects()).find((p) => !p.archived)!;
  const day = "2026-01-01"; // A holiday, so nothing else is there.
  const added = await api.addEntry({
    date: day,
    start: "22:00",
    end: "23:00",
    project: project.name,
    note: "live test",
  });
  try {
    assert.equal(added.hours, 1);
    assert.equal(added.project, project.name);
    const overlap = await api.addEntry({ date: day, start: "22:30", end: "23:30", project: project.name }).then(
      () => undefined,
      (error: unknown) => error,
    );
    assert.ok(overlap instanceof WorkTrackerError && overlap.kind === "tool", "overlaps are refused");
    const updated = await api.updateEntry(added.id, { end: "24:00", note: "" });
    assert.equal(updated.end, "24:00");
    assert.equal(updated.hours, 2);
    assert.equal(updated.note, undefined);
  } finally {
    await api.deleteEntries([added.id]);
  }
  assert.equal(
    (await api.listEntries(day)).entries.some((e) => e.id === added.id),
    false,
  );
});

test("archived projects take no entries", { skip }, async () => {
  const archived = (await api.listProjects(true)).find((p) => p.archived);
  if (!archived) return;
  const error = await api.addEntry({ date: "2026-01-01", start: "10:00", end: "11:00", project: archived.name }).then(
    () => undefined,
    (error: unknown) => error,
  );
  assert.ok(error instanceof WorkTrackerError && error.kind === "tool");
});

test("start and discard the timer", { skip }, async () => {
  if ((await api.getOverview()).timer.running) return; // Don't disturb a running timer.
  const project = (await api.listProjects()).find((p) => !p.archived)!;
  const started = await api.startTimer(project.name);
  assert.equal(started.timer.running, true);
  await api.discardTimer();
  assert.equal((await api.getOverview()).timer.running, false);
});

test("log and delete a call", { skip }, async () => {
  const call = await api.logCall({ caller: "Live Test", topic: "Raycast", length: "short", solved_by_me: true });
  try {
    assert.equal(call.caller, "Live Test");
    assert.equal(call.solved_by, "me");
  } finally {
    await api.deleteCalls([call.id]);
  }
});

test("recent calls include the latest", { skip }, async () => {
  const call = await api.logCall({ caller: "Live Test Latest", length: "short", solved_by_me: false });
  try {
    const calls = await recentCalls(api.listCalls, call.date);
    assert.equal(calls[0]?.id, call.id);
  } finally {
    await api.deleteCalls([call.id]);
  }
});

test("record and remove an absence; replacing one is detected", { skip }, async () => {
  const day = "2027-03-03"; // A Wednesday, far enough ahead to be free.
  const result = await api.setAbsences(day, day, "sick", true);
  try {
    assert.deepEqual(result.days, [day]);
    const absences = await api.listAbsences(day, day);
    assert.equal(absences[0]?.half_day, true);
    assert.equal(replacedAbsences(absences, "sick", true).length, 0);
    assert.equal(replacedAbsences(absences, "sick", false).length, 1);
    assert.equal(replacedAbsences(absences, "vacation", true).length, 1);
  } finally {
    await api.removeAbsences(day);
  }
  assert.equal((await api.listAbsences(day, day)).length, 0);
});
