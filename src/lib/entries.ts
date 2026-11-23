/** Start and end (minutes) for a new entry among `taken` [start, end) ranges. */
export function freeSlot(taken: [number, number][], now?: number): { start: number; end: number } {
  const DAY = 24 * 60;
  const MIN = 15;
  const sorted = [...taken].sort((a, b) => a[0] - b[0]);
  const lastEnd = sorted.reduce((latest, [, end]) => Math.max(latest, end), -1);
  // WorkTracker's own default for an empty day (EntryActions.nextStart).
  let start = 8 * 60 + 10;
  if (lastEnd >= 0 && lastEnd <= DAY - MIN) {
    start = lastEnd;
  } else if (lastEnd > DAY - MIN) {
    // Taken up to midnight: the latest gap of at least 15 minutes (a missing lunch break
    // is likelier than the small hours); without one, 08:10, and WorkTracker explains the overlap.
    let cursor = 0;
    for (const [from, to] of sorted) {
      if (from - cursor >= MIN) start = cursor;
      cursor = Math.max(cursor, to);
    }
  }
  const next = sorted.find(([from]) => from >= start + 1)?.[0] ?? DAY;
  const limit = Math.min(next, DAY);
  const end = now !== undefined && now > start && now <= limit ? now : Math.min(start + 60, limit);
  return { start, end };
}

/**
 * The fields of an edited entry that differ from the entry, for update_entry. Unchanged
 * times aren't resent: a time in the hour that repeats when summer time ends would be read
 * as its first occurrence and could move the entry. A new day keeps the times on its own.
 */
export function changedFields(
  entry: { date: string; start: string; end: string; project: string | null; note?: string },
  fields: { date: string; start: string; end: string; project: string; note: string },
): Partial<typeof fields> {
  const changes: Partial<typeof fields> = {};
  if (fields.date !== entry.date) changes.date = fields.date;
  if (fields.start !== entry.start) changes.start = fields.start;
  if (fields.end !== entry.end) changes.end = fields.end;
  if (fields.project !== (entry.project ?? "")) changes.project = fields.project;
  if (fields.note !== (entry.note ?? "")) changes.note = fields.note;
  return changes;
}

/** "Other" in WorkTracker's UI languages (Localizable.xcstrings). */
const OTHER_NAMES = ["Other", "Andere"];

/**
 * The project a new entry starts with, as WorkTracker's entry sheet picks it: the active
 * project called "Other" (in any of its languages, ignoring case and accents); else the
 * one worked on most recently; else the first.
 */
export function defaultProject<P extends { name: string; archived: boolean; last_worked?: string; entries: number }>(
  projects: P[],
): P | undefined {
  const active = projects.filter((project) => !project.archived);
  const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
  const other = active.find((project) => OTHER_NAMES.some((name) => same(name, project.name)));
  if (other) return other;
  return [...active].sort(
    (a, b) => (b.last_worked ?? "").localeCompare(a.last_worked ?? "") || b.entries - a.entries,
  )[0];
}
