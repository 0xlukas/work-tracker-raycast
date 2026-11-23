import { addDays, daysBetween } from "./format";
import type { Call } from "./types";

type ListCalls = (from: string, to: string) => Promise<{ count: number; calls: Call[] }>;

/**
 * Calls in a range, newest first, none missing. `list_calls` returns the *oldest* calls
 * when a range has more than its limit, so a crowded range is split and the later half
 * fetched first.
 */
export async function callsNewestFirst(list: ListCalls, from: string, to: string): Promise<Call[]> {
  const { count, calls } = await list(from, to);
  if (count <= calls.length || from === to) return [...calls].reverse();
  const middle = addDays(from, Math.floor(daysBetween(from, to) / 2));
  const later = await callsNewestFirst(list, addDays(middle, 1), to);
  const earlier = await callsNewestFirst(list, from, middle);
  return [...later, ...earlier];
}

/**
 * The last year's calls, newest first, for suggesting callers and topics. Starts with the
 * last month and only goes further back while there are few calls, so the latest calls
 * are always there and heavy years don't load in full.
 */
export async function recentCalls(list: ListCalls, today: string, enough = 300): Promise<Call[]> {
  const windows: [number, number][] = [
    [-29, 0],
    [-89, -30],
    [-364, -90],
  ];
  const result: Call[] = [];
  for (const [start, end] of windows) {
    result.push(...(await callsNewestFirst(list, addDays(today, start), addDays(today, end))));
    if (result.length >= enough) break;
  }
  return result;
}
