import { Action, ActionPanel, Detail, Icon, Keyboard, popToRoot } from "@raycast/api";
import { quoteOfTheDay } from "./lib/quotes";

/** Today's quote: the same one WorkTracker shows when it opens. */
export default function DailyQuote() {
  const quote = quoteOfTheDay();
  const markdown = [
    "# ★",
    "",
    `> ## *“${quote.text}”*`,
    "",
    `**— ${quote.thinker}**${quote.source ? `  \n*${quote.source}*` : ""}`,
  ].join("\n");
  const plain = `“${quote.text}” — ${quote.thinker}${quote.source ? `, ${quote.source}` : ""}`;

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Daily Quote"
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Thinker" text={quote.thinker} icon={Icon.Person} />
          {quote.source && <Detail.Metadata.Label title="Source" text={quote.source} icon={Icon.Book} />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Dismiss" icon={Icon.XMarkCircle} onAction={() => popToRoot()} />
          <Action.CopyToClipboard title="Copy Quote" content={plain} shortcut={Keyboard.Shortcut.Common.Copy} />
        </ActionPanel>
      }
    />
  );
}
