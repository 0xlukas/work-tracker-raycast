import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { recordAbsences } from "../lib/absences";
import { listAbsenceCategories, listDaysWithoutEntries } from "../lib/api";
import { formatDay, formatHours } from "../lib/format";
import type { AbsenceCategory, MissingDay } from "../lib/types";
import { CommonActions, ErrorEmptyView, useWorkTracker } from "../lib/ui";
import { AbsenceForm } from "./AbsenceForm";
import { DayView } from "./DayView";
import { EntryForm } from "./EntryForm";

async function load() {
  const [days, categories] = await Promise.all([listDaysWithoutEntries(), listAbsenceCategories()]);
  return { days, categories: categories.filter((c) => !c.archived) };
}

/** Past working days without entries or absence, most recent first (WorkTracker's list). */
export function MissingDaysList() {
  const { data, isLoading, error, revalidate } = useWorkTracker(load, []);
  return (
    <List isLoading={isLoading} navigationTitle="Days Without Entries">
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : (
        <>
          <List.Section
            title="Days Without Entries"
            subtitle={data?.days.length ? String(data.days.length) : undefined}
          >
            {data?.days.map((day) => (
              <MissingDayItem key={day.date} day={day} categories={data.categories} onChange={revalidate} />
            ))}
          </List.Section>
          {data && data.days.length === 0 && (
            <List.EmptyView
              icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
              title="All caught up"
              description="Every past working day has entries or an absence."
            />
          )}
        </>
      )}
    </List>
  );
}

function MissingDayItem({
  day,
  categories,
  onChange,
}: {
  day: MissingDay;
  categories: AbsenceCategory[];
  onChange: () => void;
}) {
  async function record(category: AbsenceCategory, halfDay: boolean) {
    await recordAbsences({
      from: day.date,
      to: day.date,
      category: category.category_id ?? category.category,
      categoryName: category.category_name ?? category.category,
      halfDay,
      onChange,
    });
  }

  return (
    <List.Item
      icon={{ source: Icon.Calendar, tintColor: Color.Orange }}
      title={formatDay(day.date, "short")}
      subtitle={day.date.slice(0, 4)}
      keywords={[day.weekday, day.date]}
      accessories={[{ text: `${formatHours(day.expected)} expected` }]}
      actions={
        <ActionPanel>
          <Action.Push title="Add Entry" icon={Icon.Plus} target={<EntryForm date={day.date} onSaved={onChange} />} />
          <ActionPanel.Submenu title="Record Absence" icon={Icon.Airplane} shortcut={{ modifiers: ["cmd"], key: "b" }}>
            {categories.map((category) => (
              <Action
                key={category.category_id ?? category.category}
                title={category.category_name ?? category.category}
                onAction={() => record(category, false)}
              />
            ))}
          </ActionPanel.Submenu>
          <ActionPanel.Submenu title="Record Half-Day Absence" icon={Icon.Airplane}>
            {categories.map((category) => (
              <Action
                key={category.category_id ?? category.category}
                title={category.category_name ?? category.category}
                onAction={() => record(category, true)}
              />
            ))}
          </ActionPanel.Submenu>
          <Action.Push
            title="Record Absence for Several Days…"
            icon={Icon.Calendar}
            target={<AbsenceForm from={day.date} onSaved={onChange} />}
          />
          <Action.Push
            title="Show Day"
            icon={Icon.List}
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            target={<DayView initialDay={day.date} />}
          />
          <CommonActions onRefresh={onChange} />
        </ActionPanel>
      }
    />
  );
}
