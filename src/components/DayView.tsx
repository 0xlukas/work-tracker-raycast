import { Action, ActionPanel, Alert, Color, Icon, Keyboard, List, confirmAlert } from "@raycast/api";
import { useState, type ReactElement } from "react";
import { deleteEntries, getOverview, getSummary, listEntries, listProjects, stopTimer } from "../lib/api";
import { addDays, formatBalance, formatDay, formatHours, relativeDay, zurichToday } from "../lib/format";
import type { Entry, Overview, Project, SummaryDay } from "../lib/types";
import { CommonActions, ErrorEmptyView, balanceColor, perform, projectIcon, useWorkTracker } from "../lib/ui";
import { EntryForm } from "./EntryForm";
import { TimerList } from "./TimerList";

async function loadDay(day: string) {
  const isToday = day === zurichToday();
  const [entries, summary, projects, overview] = await Promise.all([
    listEntries(day),
    getSummary(day, day, "day"),
    listProjects(true),
    isToday ? getOverview() : Promise.resolve(undefined),
  ]);
  return {
    entries: entries.entries,
    day: summary.days?.[0] as SummaryDay | undefined,
    worked: summary.worked ?? entries.total_hours,
    expected: summary.expected ?? 0,
    balance: summary.balance ?? entries.total_hours,
    beforeTracking: summary.note !== undefined && summary.worked === undefined,
    colors: Object.fromEntries(projects.map((p) => [p.name, p.color])) as Record<string, Project["color"]>,
    overview,
  };
}

/** A day's entries and totals (today by default), with a dropdown for the past week. */
export function DayView({ initialDay }: { initialDay?: string }) {
  const today = zurichToday();
  const [day, setDay] = useState(initialDay ?? today);
  const { data, isLoading, error, revalidate } = useWorkTracker(loadDay, [day]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  if (initialDay && !days.includes(initialDay)) days.push(initialDay);

  const addAction = (
    <Action.Push
      title="Add Entry"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<EntryForm date={day} onSaved={revalidate} />}
    />
  );

  return (
    <List
      isLoading={isLoading}
      navigationTitle={formatDay(day)}
      searchBarPlaceholder="Filter entries"
      searchBarAccessory={
        <List.Dropdown tooltip="Day" value={day} onChange={setDay}>
          {days.map((d) => (
            <List.Dropdown.Item key={d} value={d} title={relativeDay(d, today)} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : data ? (
        <>
          <List.Section title={relativeDay(day, today)} subtitle={formatDay(day)}>
            <SummaryItem data={data} day={day} addAction={addAction} onRefresh={revalidate} />
            {data.overview?.timer.running && <TimerItem overview={data.overview} onChange={revalidate} />}
          </List.Section>
          <List.Section
            title="Entries"
            subtitle={data.entries.length > 0 ? `${data.entries.length} · ${formatHours(data.worked)}` : undefined}
          >
            {data.entries.map((entry) => (
              <EntryItem
                key={entry.id}
                entry={entry}
                color={entry.project ? data.colors[entry.project] : undefined}
                addAction={addAction}
                onChange={revalidate}
              />
            ))}
          </List.Section>
          {data.entries.length === 0 && !isLoading && (
            <List.EmptyView
              icon={Icon.Clock}
              title={`No entries ${day === today ? "today" : `on ${formatDay(day, "short")}`}`}
              actions={<ActionPanel>{addAction}</ActionPanel>}
            />
          )}
        </>
      ) : null}
    </List>
  );
}

function SummaryItem({
  data,
  day,
  addAction,
  onRefresh,
}: {
  data: Awaited<ReturnType<typeof loadDay>>;
  day: string;
  addAction: ReactElement;
  onRefresh: () => void;
}) {
  const details: List.Item.Accessory[] = [];
  if (data.day?.holiday) details.push({ tag: { value: data.day.holiday, color: Color.Purple }, icon: Icon.Star });
  if (data.day?.absence) {
    const absence = data.day.absence;
    const name = absence.category_name ?? absence.category;
    details.push({ tag: { value: absence.days === 0.5 ? `${name} (half day)` : name, color: Color.Blue } });
  }
  if (data.overview) {
    details.push({
      text: `Week ${formatBalance(data.overview.this_week.balance)}`,
      tooltip: `This week: ${formatHours(data.overview.this_week.worked)} of ${formatHours(data.overview.this_week.expected)}`,
    });
  }
  const subtitle = data.beforeTracking
    ? "Before the tracking start"
    : data.expected > 0
      ? `of ${formatHours(data.expected)}`
      : "Nothing expected";
  return (
    <List.Item
      icon={{ source: Icon.BarChart, tintColor: balanceColor(data.balance) }}
      title={formatHours(data.worked)}
      subtitle={subtitle}
      keywords={["total", "balance"]}
      accessories={[
        ...details,
        {
          tag: { value: formatBalance(data.balance), color: balanceColor(data.balance) },
          tooltip: "Balance for the day",
        },
      ]}
      actions={
        <ActionPanel>
          {addAction}
          {day === zurichToday() && (
            <Action.Push title="Start or Stop Timer" icon={Icon.Stopwatch} target={<TimerList />} />
          )}
          <CommonActions onRefresh={onRefresh} />
        </ActionPanel>
      }
    />
  );
}

function TimerItem({ overview, onChange }: { overview: Overview; onChange: () => void }) {
  if (!overview.timer.running) return null;
  const timer = overview.timer;
  return (
    <List.Item
      icon={{ source: Icon.Stopwatch, tintColor: Color.Red }}
      title={`Timer: ${timer.project ?? "No project"}`}
      subtitle={`since ${timer.started.slice(11)}`}
      accessories={[{ text: formatHours(timer.elapsed_hours), tooltip: "Running (not in the totals yet)" }]}
      actions={
        <ActionPanel>
          <Action
            title="Stop Timer"
            icon={Icon.Stop}
            onAction={async () => {
              await perform(
                "Stopping timer…",
                () => stopTimer(),
                (result) => ({
                  title: "Timer stopped",
                  message: result.note ?? `Saved ${formatHours(result.saved.reduce((sum, e) => sum + e.hours, 0))}`,
                }),
              );
              onChange();
            }}
          />
          <CommonActions onRefresh={onChange} />
        </ActionPanel>
      }
    />
  );
}

function EntryItem({
  entry,
  color,
  addAction,
  onChange,
}: {
  entry: Entry;
  color: Project["color"] | undefined;
  addAction: ReactElement;
  onChange: () => void;
}) {
  const accessories: List.Item.Accessory[] = [];
  if (entry.note) accessories.push({ icon: Icon.Text, tooltip: entry.note });
  accessories.push({ tag: formatHours(entry.hours) });

  async function remove() {
    const confirmed = await confirmAlert({
      title: "Delete this entry?",
      message: `${entry.start}–${entry.end}, ${entry.project ?? "no project"} (${formatHours(entry.hours)}). This syncs to your other Macs.`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    await perform(
      "Deleting entry…",
      () => deleteEntries([entry.id]),
      () => ({ title: "Entry deleted" }),
    );
    onChange();
  }

  return (
    <List.Item
      icon={projectIcon(color)}
      title={`${entry.start} – ${entry.end}`}
      subtitle={entry.note ? `${entry.project ?? "No project"} · ${entry.note}` : (entry.project ?? "No project")}
      keywords={[entry.project ?? "", entry.note ?? ""]}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.Push title="Edit Entry" icon={Icon.Pencil} target={<EntryForm entry={entry} onSaved={onChange} />} />
          {addAction}
          <Action.CopyToClipboard
            title="Copy Entry"
            content={`${entry.date} ${entry.start}–${entry.end} ${entry.project ?? ""}${entry.note ? ` (${entry.note})` : ""}`}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action
            title="Delete Entry"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
            onAction={remove}
          />
          <CommonActions onRefresh={onChange} />
        </ActionPanel>
      }
    />
  );
}
