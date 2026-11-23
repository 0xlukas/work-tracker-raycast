import assert from "node:assert/strict";
import { test } from "node:test";
import { describeSkipped, replacedAbsences } from "../src/lib/absence-rules";
import { callsNewestFirst, recentCalls } from "../src/lib/calls";
import { freeSlot } from "../src/lib/entries";
import { addDays, minutesOf, momentFromPicker, shortMoment, timeOf } from "../src/lib/format";
import type { Absence, Call } from "../src/lib/types";

// A fake list_calls: `calls` per day, oldest first, truncated to the *oldest* `limit` like WorkTracker.
function fakeCalls(perDay: Record<string, number>, limit: number) {
  const all: Call[] = Object.entries(perDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, count]) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${date}-${i}`,
        date,
        weekday: "",
        time: `${String(8 + i).padStart(2, "0")}:00`,
        caller: `Caller ${date}`,
        topic: null,
        department: null,
        length: "short" as const,
        solved_by: "me" as const,
      })),
    );
  let requests = 0;
  const list = async (from: string, to: string) => {
    requests++;
    const inRange = all.filter((call) => call.date >= from && call.date <= to);
    return { count: inRange.length, calls: inRange.slice(0, limit) };
  };
  return { list, all, requests: () => requests };
}

test("calls come newest first and none go missing when a range is truncated", async () => {
  const perDay: Record<string, number> = {};
  for (let i = 0; i < 40; i++) perDay[addDays("2026-11-23", -i)] = 3; // 120 calls, limit 50
  const fake = fakeCalls(perDay, 50);
  const calls = await callsNewestFirst(fake.list, "2026-10-01", "2026-11-23");
  assert.equal(calls.length, 120);
  assert.equal(calls[0].date, "2026-11-23");
  assert.equal(calls[0].time, "10:00"); // the day's latest call first
  assert.equal(calls.at(-1)!.date, addDays("2026-11-23", -39));
});

test("recent calls stop widening once there are enough", async () => {
  const perDay: Record<string, number> = { "2026-11-20": 5, "2026-09-01": 5, "2026-01-10": 5 };
  const few = fakeCalls(perDay, 2000);
  assert.deepEqual(
    (await recentCalls(few.list, "2026-11-23")).map((c) => c.date),
    [...Array(5).fill("2026-11-20"), ...Array(5).fill("2026-09-01"), ...Array(5).fill("2026-01-10")],
  );
  const many = fakeCalls(perDay, 2000);
  assert.equal((await recentCalls(many.list, "2026-11-23", 5)).length, 5);
  assert.equal(many.requests(), 1); // the last month was enough
});

test("a new entry's default slot", () => {
  const m = (time: string) => minutesOf(time);
  const slot = (taken: [string, string][], now?: string) => {
    const { start, end } = freeSlot(
      taken.map(([a, b]) => [m(a), m(b)]),
      now ? m(now) : undefined,
    );
    return `${timeOf(start)}–${timeOf(end)}`;
  };
  assert.equal(slot([]), "08:00–09:00");
  assert.equal(slot([], "10:35"), "08:00–10:35");
  assert.equal(slot([["08:00", "12:00"]], "14:10"), "12:00–14:10");
  assert.equal(
    slot([
      ["08:00", "12:00"],
      ["13:00", "17:00"],
    ]),
    "17:00–18:00",
  );
  // A day taken up to midnight: the latest gap, not 23:45–24:00.
  assert.equal(
    slot([
      ["08:00", "12:00"],
      ["13:00", "24:00"],
    ]),
    "12:00–13:00",
  );
  assert.equal(slot([["00:00", "24:00"]]), "08:00–09:00");
  assert.equal(
    slot([
      ["00:00", "12:00"],
      ["12:30", "24:00"],
    ]),
    "12:00–12:30",
  );
  // Ending now would run into a later entry: an hour, up to that entry.
  assert.equal(
    slot(
      [
        ["06:00", "07:00"],
        ["07:30", "24:00"],
      ],
      "09:00",
    ),
    "07:00–07:30",
  );
  assert.equal(slot([["23:00", "23:30"]]), "23:30–24:00");
});

test("a picked moment is sent in Zurich time", () => {
  assert.equal(momentFromPicker(new Date("2026-11-23T08:15:00Z")), "2026-11-23 09:15");
  assert.equal(momentFromPicker(new Date("2026-07-01T22:30:00Z")), "2026-07-02 00:30");
  assert.equal(shortMoment("2026-11-23 09:10", "2026-11-23"), "09:10");
  assert.equal(shortMoment("2026-11-22 17:00", "2026-11-23"), "Sun 22 Nov 17:00");
});

test("which absences set_absences would replace", () => {
  const absence = (date: string, category: string, halfDay: boolean, id?: string): Absence => ({
    date,
    weekday: "",
    category,
    category_id: id,
    half_day: halfDay,
    counted_days: halfDay ? 0.5 : 1,
  });
  const existing = [
    absence("2026-11-02", "vacation", false),
    absence("2026-11-03", "vacation", true),
    absence("2026-11-04", "sick", false),
    absence("2026-11-05", "Training", false, "17656BAD"),
  ];
  assert.deepEqual(
    replacedAbsences(existing, "vacation", false).map((a) => a.date),
    ["2026-11-03", "2026-11-04", "2026-11-05"],
  );
  assert.deepEqual(
    replacedAbsences(existing, "17656BAD", false).map((a) => a.date),
    ["2026-11-02", "2026-11-03", "2026-11-04"],
  );
});

test("skipped days: holidays by name, the rest counted", () => {
  assert.equal(
    describeSkipped([
      { date: "2026-12-25", reason: "public holiday (Christmas Day)" },
      { date: "2026-12-26", reason: "no scheduled hours" },
      { date: "2026-12-27", reason: "no scheduled hours" },
    ]),
    "Skipped Fri 25 Dec (Christmas Day), +2 non-working days",
  );
  assert.equal(describeSkipped([]), undefined);
});
