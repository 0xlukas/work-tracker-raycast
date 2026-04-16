import { showHUD } from "@raycast/api";
import { quoteOfTheDay } from "./lib/quotes";

export default async function DailyQuote() {
  const quote = quoteOfTheDay();
  const source = quote.source ? ` (${quote.source})` : "";
  await showHUD(`\u201C${quote.text}\u201D \u2014 ${quote.thinker}${source}`);
}
