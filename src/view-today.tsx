import { List, ActionPanel, Action, Icon, Color, confirmAlert, Alert, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { getSegmentsForDate, getAbsencesForYear, buildAbsenceLookup } from "./lib/queries";
import { deleteSegment } from "./lib/mutations";
import { WorkHoursCalculator, daySummaryLabel, formatHours } from "./lib/calculator";
import { getZurichComponents } from "./lib/dates";
import { formatTimeOfDay } from "./lib/timeinput";
import type { WorkSegment } from "./lib/types";

export default function ViewToday() {
  const [segments, setSegments] = useState<WorkSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayHours, setTodayHours] = useState(0);
  const [expectedHours, setExpectedHours] = useState(8);
  const [dayLabel, setDayLabel] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      const { year } = getZurichComponents(now);
      const [todaySegments, absences] = await Promise.all([getSegmentsForDate(now), getAbsencesForYear(year)]);
      const absenceLookup = buildAbsenceLookup(absences);

      const calculator = new WorkHoursCalculator([year]);
      const { daySummary, todayHours: hours } = calculator.todaySummary(absenceLookup, todaySegments);

      setSegments(todaySegments);
      setTodayHours(hours);
      setExpectedHours(daySummary.expectedHours);
      setDayLabel(daySummaryLabel(daySummary));
    } catch (error) {
      showToast({ style: Toast.Style.Failure, title: "Failed to load data", message: String(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dateStr = new Intl.DateTimeFormat("en-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const balanceColor = todayHours >= expectedHours ? Color.Green : Color.Orange;

  async function handleDelete(segment: WorkSegment) {
    const confirmed = await confirmAlert({
      title: "Delete Entry",
      message: `Delete ${formatTimeRange(segment)}?`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });

    if (confirmed) {
      try {
        deleteSegment(segment.id);
        showToast({ style: Toast.Style.Success, title: "Entry deleted" });
        await loadData();
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to delete", message: String(error) });
      }
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle="View Today">
      <List.Section
        title={dateStr}
        subtitle={`${formatHours(todayHours)} / ${formatHours(expectedHours)}${dayLabel ? ` \u2022 ${dayLabel}` : ""}`}
      >
        {segments.length === 0 && !isLoading ? (
          <List.EmptyView
            title="No entries today"
            description="Use 'Add Work Entry' to log your time"
            icon={Icon.Clock}
          />
        ) : (
          segments.map((seg) => (
            <List.Item
              key={seg.id}
              icon={{ source: Icon.Clock, tintColor: balanceColor }}
              title={formatTimeRange(seg)}
              subtitle={seg.projectName ?? "No project"}
              accessories={[{ text: formatHours(seg.durationHours), icon: Icon.Hourglass }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Delete Entry"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => handleDelete(seg)}
                  />
                  <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={loadData} />
                </ActionPanel>
              }
            />
          ))
        )}
      </List.Section>
    </List>
  );
}

function formatTimeRange(seg: WorkSegment): string {
  return `${formatTimeOfDay(seg.startTime)} \u2013 ${formatTimeOfDay(seg.endTime)}`;
}
