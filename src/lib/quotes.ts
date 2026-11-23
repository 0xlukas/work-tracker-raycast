import { daysBetween, minutesOf, zurichParts } from "./format";
import quotes from "./quotes.json";

export interface Quote {
  text: string;
  thinker: string;
  source: string | null;
}

export const ALL_QUOTES: Quote[] = quotes;

/**
 * Which quote WorkTracker shows at `now`. Mirrors `DailyQuote.quoteOfTheDay()`: whole
 * Zurich calendar days since 1970-01-01 01:00 (the Unix epoch in Zurich), so the quote
 * changes at 1 am, like the app's.
 */
export function quoteIndex(now: Date, count: number): number {
  const { day, time } = zurichParts(now);
  const days = daysBetween("1970-01-01", day) - (minutesOf(time) < 60 ? 1 : 0);
  return Math.abs(days) % count;
}

export function quoteOfTheDay(now: Date = new Date()): Quote {
  return ALL_QUOTES[quoteIndex(now, ALL_QUOTES.length)];
}
