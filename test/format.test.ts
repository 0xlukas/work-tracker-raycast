import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  daysBetween,
  formatBalance,
  formatDay,
  formatHours,
  parseTimeInput,
  relativeDay,
  startOfWeek,
  zurichParts,
} from "../src/lib/format";
import { ALL_QUOTES, quoteIndex } from "../src/lib/quotes";

test("hours read like WorkTracker's", () => {
  assert.equal(formatHours(8), "8h 00m");
  assert.equal(formatHours(7.999), "8h 00m");
  assert.equal(formatHours(3.25), "3h 15m");
  assert.equal(formatBalance(2.5), "+2h 30m");
  assert.equal(formatBalance(-0.75), "-0h 45m");
  assert.equal(formatBalance(0), "+0h 00m");
  assert.equal(formatBalance(-0.001), "+0h 00m");
});

test("typed times are read like WorkTracker's TimeField.parse", () => {
  assert.equal(parseTimeInput("8 10"), "08:10");
  assert.equal(parseTimeInput("9:5"), "09:05");
  assert.equal(parseTimeInput("12345"), "23:45"); // the last four digits
  assert.equal(parseTimeInput("810"), "08:10");
  assert.equal(parseTimeInput("0810"), "08:10");
  assert.equal(parseTimeInput(""), undefined);
  assert.equal(parseTimeInput("8:"), undefined);
  assert.equal(parseTimeInput("8"), "08:00");
  assert.equal(parseTimeInput("830"), "08:30");
  assert.equal(parseTimeInput("0830"), "08:30");
  assert.equal(parseTimeInput("8:30"), "08:30");
  assert.equal(parseTimeInput("17.45"), "17:45");
  assert.equal(parseTimeInput("9h15"), "09:15");
  assert.equal(parseTimeInput("24:00"), undefined);
  assert.equal(parseTimeInput("24:00", true), "24:00");
  assert.equal(parseTimeInput("24:30", true), undefined);
  assert.equal(parseTimeInput("8:60"), undefined);
  assert.equal(parseTimeInput("noon"), undefined);
});

test("day arithmetic on YYYY-MM-DD", () => {
  assert.equal(addDays("2026-03-28", 2), "2026-03-30"); // across the DST change
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(startOfWeek("2026-11-23"), "2026-11-23"); // a Monday
  assert.equal(startOfWeek("2026-11-29"), "2026-11-23"); // a Sunday
  assert.equal(daysBetween("1970-01-01", "2026-11-23"), 20780);
  assert.equal(formatDay("2026-11-23"), "Monday, 23 November 2026");
  assert.equal(relativeDay("2026-11-22", "2026-11-23"), "Yesterday");
});

test("Zurich time regardless of the Mac's time zone", () => {
  assert.deepEqual(zurichParts(new Date("2026-11-22T23:30:00Z")), { day: "2026-11-23", time: "00:30" });
  assert.deepEqual(zurichParts(new Date("2026-07-01T22:30:00Z")), { day: "2026-07-02", time: "00:30" });
});

test("the daily quote matches WorkTracker's DailyQuote.quoteOfTheDay()", () => {
  assert.equal(ALL_QUOTES.length, 121);
  // Day numbers from Swift: Calendar.zurich.dateComponents([.day], from: epoch, to: date).
  const swift: [string, number][] = [
    ["2026-11-23T13:00:00Z", 20780],
    ["2026-11-22T23:30:00Z", 20779], // 00:30 in Zurich: the app still shows yesterday's
    ["2026-11-23T00:30:00Z", 20780], // 01:30
    ["2026-07-01T22:30:00Z", 20635], // summer time
    ["2026-07-01T23:30:00Z", 20636],
  ];
  for (const [moment, days] of swift) {
    assert.equal(quoteIndex(new Date(moment), ALL_QUOTES.length), days % ALL_QUOTES.length, moment);
  }
});
