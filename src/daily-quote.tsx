import { Detail, ActionPanel, Action, Icon, popToRoot } from "@raycast/api";
import { quoteOfTheDay } from "./lib/quotes";

export default function DailyQuote() {
  const quote = quoteOfTheDay();

  const markdown = [
    "# \u2605",
    "",
    `> ## *\u201C${quote.text}\u201D*`,
    "",
    "---",
    "",
    `### \u2014 ${quote.thinker}`,
    "",
    quote.source ? `*${quote.source}*` : "",
  ].join("\n");

  return (
    <Detail
      markdown={markdown}
      navigationTitle="Daily Quote"
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Thinker" text={quote.thinker} icon={Icon.Person} />
          {quote.source && <Detail.Metadata.Separator />}
          {quote.source && <Detail.Metadata.Label title="Source" text={quote.source} icon={Icon.Book} />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Dismiss" icon={Icon.XMarkCircle} onAction={popToRoot} />
          <Action
            title="Dismiss (Space)"
            icon={Icon.XMarkCircle}
            onAction={popToRoot}
            shortcut={{ modifiers: [], key: "space" }}
          />
        </ActionPanel>
      }
    />
  );
}
