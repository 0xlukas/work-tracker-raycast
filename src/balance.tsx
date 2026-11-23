import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { getOverview } from "./lib/api";
import type { ReactNode } from "react";
import {
  dayCount,
  formatBalance,
  formatDay,
  formatDays,
  formatHours,
  startOfMonth,
  startOfWeek,
  zurichToday,
} from "./lib/format";
import type { Overview, Totals } from "./lib/types";
import { CommonActions, ErrorEmptyView, balanceColor, useWorkTracker } from "./lib/ui";
import { DayView } from "./components/DayView";
import { MissingDaysList } from "./components/MissingDaysList";
import { PeriodView } from "./components/PeriodView";
import { TimerList } from "./components/TimerList";
import { VacationView } from "./components/VacationView";

/** WorkTracker's overview: balances, vacation, days without entries, timer and sync. */
export default function Balance() {
  const { data, isLoading, error, revalidate } = useWorkTracker(getOverview, []);
  return (
    <List isLoading={isLoading} navigationTitle="Work Balance">
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : (
        data && <OverviewSections overview={data} onRefresh={revalidate} />
      )}
    </List>
  );
}

function OverviewSections({ overview, onRefresh }: { overview: Overview; onRefresh: () => void }) {
  const today = overview.now.slice(0, 10);
  const year = today.slice(0, 4);
  const common = <CommonActions onRefresh={onRefresh} />;
  const missing = overview.days_without_entries;
  const vacation = overview.vacation;
  const sync = overview.sync;

  return (
    <>
      <List.Section title="Balance" subtitle={`${overview.weekday}, ${formatDay(today, "short")}`}>
        <PeriodItem
          title="Today"
          totals={overview.today}
          target={<DayView />}
          targetTitle="Show Today"
          common={common}
        />
        <PeriodItem
          title="This Week"
          totals={overview.this_week}
          target={<PeriodView title="This Week" from={startOfWeek(today)} to={today} breakdown="day" />}
          common={common}
        />
        <PeriodItem
          title="This Month"
          totals={overview.this_month}
          target={<PeriodView title="This Month" from={startOfMonth(today)} to={today} breakdown="day" />}
          common={common}
        />
        <PeriodItem
          title="This Year"
          subtitle={`of ${formatHours(overview.this_year_expected_in_total)} this year`}
          totals={overview.this_year_to_date}
          target={
            <PeriodView
              title={year}
              from={maxDay(`${year}-01-01`, overview.tracking_start)}
              to={today}
              breakdown="month"
            />
          }
          common={common}
        />
        <List.Item
          icon={{ source: Icon.Coins, tintColor: balanceColor(overview.all_time_balance) }}
          title="Overtime"
          subtitle={
            overview.opening_balance !== 0
              ? `since ${formatDay(overview.tracking_start, "medium")}, incl. ${formatBalance(overview.opening_balance)} opening balance`
              : `since ${formatDay(overview.tracking_start, "medium")}`
          }
          accessories={[
            {
              tag: { value: formatBalance(overview.all_time_balance), color: balanceColor(overview.all_time_balance) },
              tooltip: "All-time balance",
            },
          ]}
          actions={<ActionPanel>{common}</ActionPanel>}
        />
      </List.Section>

      <List.Section title="Time Off">
        <List.Item
          icon={{ source: Icon.Airplane, tintColor: Color.Blue }}
          title={`${dayCount(vacation.remaining_days)} of vacation left`}
          subtitle={`${vacation.year}: ${formatDays(vacation.used_days)} of ${formatDays(vacation.entitlement_days + vacation.carried_over_days)} used`}
          actions={
            <ActionPanel>
              <Action.Push title="Show Vacation" icon={Icon.Airplane} target={<VacationView />} />
              {common}
            </ActionPanel>
          }
        />
        <List.Item
          icon={{ source: Icon.Calendar, tintColor: missing.count > 0 ? Color.Orange : Color.Green }}
          title={
            missing.count === 0
              ? "No days without entries"
              : `${missing.count} ${missing.count === 1 ? "day" : "days"} without entries`
          }
          subtitle={missing.most_recent.length > 0 ? `latest ${formatDay(missing.most_recent[0], "short")}` : undefined}
          actions={
            <ActionPanel>
              <Action.Push title="Show Days" icon={Icon.List} target={<MissingDaysList />} />
              {common}
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Status">
        <List.Item
          icon={{ source: Icon.Stopwatch, tintColor: overview.timer.running ? Color.Red : Color.SecondaryText }}
          title={overview.timer.running ? `Timer: ${overview.timer.project ?? "No project"}` : "Timer not running"}
          subtitle={overview.timer.running ? `since ${overview.timer.started.slice(11)}` : undefined}
          accessories={overview.timer.running ? [{ text: formatHours(overview.timer.elapsed_hours) }] : []}
          actions={
            <ActionPanel>
              <Action.Push title="Start or Stop Timer" icon={Icon.Stopwatch} target={<TimerList />} />
              {common}
            </ActionPanel>
          }
        />
        {sync && <SyncItem sync={sync} common={common} />}
      </List.Section>
    </>
  );
}

function PeriodItem({
  title,
  subtitle,
  totals,
  target,
  targetTitle = "Show Days",
  common,
}: {
  title: string;
  subtitle?: string;
  totals: Totals;
  target: ReactNode;
  targetTitle?: string;
  common: ReactNode;
}) {
  return (
    <List.Item
      icon={{ source: Icon.BarChart, tintColor: balanceColor(totals.balance) }}
      title={title}
      subtitle={subtitle ?? `${formatHours(totals.worked)} of ${formatHours(totals.expected)}`}
      accessories={[
        ...(subtitle ? [{ text: `${formatHours(totals.worked)} of ${formatHours(totals.expected)} so far` }] : []),
        {
          tag: { value: formatBalance(totals.balance), color: balanceColor(totals.balance) },
          tooltip: "Worked − expected",
        },
      ]}
      actions={
        <ActionPanel>
          <Action.Push title={targetTitle} icon={Icon.List} target={target} />
          {common}
        </ActionPanel>
      }
    />
  );
}

function SyncItem({ sync, common }: { sync: NonNullable<Overview["sync"]>; common: ReactNode }) {
  const problem = sync.paused_until_answered_in_app ?? sync.error;
  if (!sync.enabled && !problem) return null;
  return (
    <List.Item
      icon={{
        source: problem ? Icon.ExclamationMark : Icon.ArrowClockwise,
        tintColor: problem ? Color.Orange : Color.Green,
      }}
      title={problem ? "Sync needs attention" : "Sync on"}
      subtitle={problem ?? (sync.last_sync ? `last synced ${lastSync(sync.last_sync)}` : undefined)}
      actions={<ActionPanel>{common}</ActionPanel>}
    />
  );
}

function maxDay(a: string, b: string): string {
  return a > b ? a : b;
}

function lastSync(moment: string): string {
  const day = moment.slice(0, 10);
  return day === zurichToday() ? moment.slice(11) : `${formatDay(day, "short")} ${moment.slice(11)}`;
}
