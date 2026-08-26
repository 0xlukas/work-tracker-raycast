import { getZurichComponents, isSameDayZurich, makeDateZurich } from "./dates";
import { formatTimeOfDay } from "./timeinput";
import type { WorkSegment } from "./types";

/** Fallback start for a day with no entries yet — cf. DailyEntryView.defaultStartForNewEntry. */
const DEFAULT_START_HOUR = 8;
const DEFAULT_START_MINUTE = 10;

/** How long a fresh entry is suggested to run for. */
const SUGGESTED_LENGTH_MS = 3600000;

/** Start to pre-fill a new entry with: the end of the day's last segment, or 08:10 when empty. */
export function defaultStartFor(date: Date, segments: WorkSegment[]): Date {
  const lastEnd = segments.reduce<Date | null>(
    (max, seg) => (max === null || seg.endTime.getTime() > max.getTime() ? seg.endTime : max),
    null,
  );
  if (lastEnd) return lastEnd;
  const { year, month, day } = getZurichComponents(date);
  return makeDateZurich(year, month, day, DEFAULT_START_HOUR, DEFAULT_START_MINUTE);
}

/**
 * End to pre-fill alongside `start`: an hour later, clamped to 23:59 so a late last
 * segment (23:30) doesn't suggest 00:30 — which re-anchors to the same day and would
 * leave the form invalid until retyped.
 */
export function suggestedEndFor(start: Date): Date {
  const plusHour = new Date(start.getTime() + SUGGESTED_LENGTH_MS);
  if (isSameDayZurich(start, plusHour)) return plusHour;
  const { year, month, day } = getZurichComponents(start);
  return makeDateZurich(year, month, day, 23, 59);
}

export interface EntryDraft {
  /** null when the field's text isn't a valid time. */
  startTime: Date | null;
  endTime: Date | null;
  /** Other segments on the same day, which the new entry must not overlap. */
  daySegments: WorkSegment[];
  hasProject: boolean;
}

/**
 * Port of SegmentEditSheet.validationError — same checks in the same order.
 * Returns null when the draft is valid.
 */
export function validateEntry({ startTime, endTime, daySegments, hasProject }: EntryDraft): string | null {
  if (!startTime || !endTime) return "Enter a start and end time.";
  if (endTime.getTime() <= startTime.getTime()) return "End time must be after start time.";
  // Defensive, and kept for parity with the app: both times are anchored to the same
  // day by `parseTimeInput`, exactly as `TimeField` anchors them to the entry's date,
  // so an overnight entry is already caught by the check above.
  if (!isSameDayZurich(startTime, endTime)) {
    return "An entry can’t cross midnight — split it into two entries.";
  }
  const clash = daySegments.find(
    (s) => startTime.getTime() < s.endTime.getTime() && endTime.getTime() > s.startTime.getTime(),
  );
  if (clash) {
    return `Overlaps with ${formatTimeOfDay(clash.startTime)}–${formatTimeOfDay(clash.endTime)}.`;
  }
  if (!hasProject) return "Select a project.";
  return null;
}
