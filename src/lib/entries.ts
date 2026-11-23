/** Start and end (minutes) for a new entry among `taken` [start, end) ranges. */
export function freeSlot(taken: [number, number][], now?: number): { start: number; end: number } {
  const DAY = 24 * 60;
  const MIN = 15;
  const sorted = [...taken].sort((a, b) => a[0] - b[0]);
  const lastEnd = sorted.reduce((latest, [, end]) => Math.max(latest, end), -1);
  let start = 8 * 60;
  if (lastEnd >= 0 && lastEnd <= DAY - MIN) {
    start = lastEnd;
  } else if (lastEnd > DAY - MIN) {
    // Taken up to midnight: the latest gap of at least 15 minutes (a missing lunch break
    // is likelier than the small hours); without one, 08:00, and WorkTracker explains the overlap.
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
