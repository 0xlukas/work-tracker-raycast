import { getZurichComponents, isSameDayZurich, makeDateZurich } from "./dates";
import { formatTimeOfDay } from "./timeinput";
import type { WorkSegment } from "./types";

/** Fallback start for a day with no entries yet — cf. DailyEntryView.defaultStartForNewEntry. */
const DEFAULT_START_HOUR = 8;
const DEFAULT_START_MINUTE = 10;

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
