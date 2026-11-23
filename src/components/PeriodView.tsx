import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { getSummary } from "../lib/api";
import { dayCount, formatBalance, formatDay, formatHours } from "../lib/format";
import type { SummaryChunk, SummaryDay } from "../lib/types";
import { CommonActions, ErrorEmptyView, balanceColor, useWorkTracker } from "../lib/ui";
import { DayView } from "./DayView";
import { EntryForm } from "./EntryForm";

/** WorkTracker's summary of a period: per day or month, per project and absences. */
export function PeriodView({
  title,
  from,
  to,
  breakdown,
}: {
  title: string;
  from: string;
  to: string;
  breakdown: "day" | "month";
}) {
  const { data, isLoading, error, revalidate } = useWorkTracker(getSummary, [from, to, breakdown]);
  const common = <CommonActions onRefresh={revalidate} />;
  return (
    <List isLoading={isLoading} navigationTitle={title}>
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : data ? (
        <>
          <List.Section title={title} subtitle={`${formatDay(data.from, "short")} – ${formatDay(data.to, "short")}`}>
            <List.Item
              icon={{ source: Icon.BarChart, tintColor: balanceColor(data.balance ?? 0) }}
              title={formatHours(data.worked ?? 0)}
              subtitle={data.note ?? `of ${formatHours(data.expected ?? 0)} · ${data.working_days ?? 0} working days`}
              accessories={[
                { tag: { value: formatBalance(data.balance ?? 0), color: balanceColor(data.balance ?? 0) } },
              ]}
              actions={<ActionPanel>{common}</ActionPanel>}
            />
          </List.Section>
          <List.Section title={breakdown === "day" ? "Days" : "Months"}>
            {breakdown === "day"
              ? [...(data.days ?? [])]
                  .reverse()
                  .map((day) => <DayItem key={day.date} day={day} onChange={revalidate} />)
              : [...(data.months ?? [])].reverse().map((month) => <MonthItem key={month.month} month={month} />)}
          </List.Section>
          <List.Section title="Projects">
            {(data.projects ?? []).map((row) => (
              <List.Item
                key={row.project}
                icon={Icon.Folder}
                title={row.project}
                accessories={[{ text: formatHours(row.hours) }]}
                actions={<ActionPanel>{common}</ActionPanel>}
              />
            ))}
          </List.Section>
          <List.Section title="Absences">
            {(data.absence_days ?? []).map((row) => (
              <List.Item
                key={row.category_id ?? row.category}
                icon={Icon.Airplane}
                title={row.category_name ?? row.category}
                accessories={[{ text: dayCount(row.days) }]}
                actions={<ActionPanel>{common}</ActionPanel>}
              />
            ))}
          </List.Section>
        </>
      ) : null}
    </List>
  );
}

function DayItem({ day, onChange }: { day: SummaryDay; onChange: () => void }) {
  const accessories: List.Item.Accessory[] = [];
  if (day.missing_entries) accessories.push({ tag: { value: "No entries", color: Color.Orange } });
  if (day.holiday) accessories.push({ tag: { value: day.holiday, color: Color.Purple } });
  if (day.absence) {
    const name = day.absence.category_name ?? day.absence.category;
    accessories.push({ tag: { value: day.absence.days === 0.5 ? `${name} ½` : name, color: Color.Blue } });
  }
  accessories.push({ tag: { value: formatBalance(day.balance), color: balanceColor(day.balance) } });
  return (
    <List.Item
      icon={{ source: Icon.Calendar, tintColor: balanceColor(day.balance) }}
      title={formatDay(day.date, "short")}
      subtitle={`${formatHours(day.worked)} of ${formatHours(day.expected)}`}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.Push title="Show Day" icon={Icon.List} target={<DayView initialDay={day.date} />} />
          <Action.Push
            title="Add Entry"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={<EntryForm date={day.date} onSaved={onChange} />}
          />
          <CommonActions onRefresh={onChange} />
        </ActionPanel>
      }
    />
  );
}

function MonthItem({ month }: { month: SummaryChunk }) {
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month.from}T00:00:00Z`),
  );
  return (
    <List.Item
      icon={{ source: Icon.Calendar, tintColor: balanceColor(month.balance) }}
      title={title}
      subtitle={`${formatHours(month.worked)} of ${formatHours(month.expected)}`}
      accessories={[{ tag: { value: formatBalance(month.balance), color: balanceColor(month.balance) } }]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Days"
            icon={Icon.List}
            target={<PeriodView title={title} from={month.from} to={month.to} breakdown="day" />}
          />
        </ActionPanel>
      }
    />
  );
}
