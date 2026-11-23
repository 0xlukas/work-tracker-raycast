import { Action, ActionPanel, Alert, Color, Icon, Keyboard, List, confirmAlert } from "@raycast/api";
import { useState, type ReactElement } from "react";
import { getVacation, listAbsences, removeAbsences } from "../lib/api";
import { dayCount, formatDay, formatDays, zurichToday } from "../lib/format";
import type { Absence } from "../lib/types";
import { CommonActions, ErrorEmptyView, perform, useWorkTracker } from "../lib/ui";
import { AbsenceForm } from "./AbsenceForm";

async function load(year: number) {
  const [vacation, absences] = await Promise.all([getVacation(year), listAbsences(`${year}-01-01`, `${year}-12-31`)]);
  return { vacation, absences };
}

/** A year's vacation allowance (WorkTracker's numbers) and its absences. */
export function VacationView() {
  const thisYear = Number(zurichToday().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { data, isLoading, error, revalidate } = useWorkTracker(load, [year]);
  const today = zurichToday();

  const recordAction = (
    <Action.Push
      title="Record Absence…"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<AbsenceForm onSaved={revalidate} />}
    />
  );
  const common = <CommonActions onRefresh={revalidate} />;

  const vacation = data?.vacation;
  const absences = data?.absences ?? [];
  const upcoming = absences.filter((a) => a.date >= today);
  const past = absences.filter((a) => a.date < today).reverse();

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`Vacation ${year}`}
      searchBarPlaceholder="Filter absences"
      searchBarAccessory={
        <List.Dropdown tooltip="Year" value={String(year)} onChange={(value) => setYear(Number(value))}>
          {[thisYear + 1, thisYear, thisYear - 1].map((y) => (
            <List.Dropdown.Item key={y} value={String(y)} title={String(y)} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <ErrorEmptyView error={error} onRetry={revalidate} />
      ) : vacation ? (
        <>
          <List.Section title={`Allowance ${year}`}>
            <List.Item
              icon={{ source: Icon.Airplane, tintColor: vacation.remaining_days > 0 ? Color.Green : Color.Orange }}
              title={`${dayCount(vacation.remaining_days)} left`}
              subtitle={`${formatDays(vacation.used_days)} used of ${formatDays(vacation.entitlement_days + vacation.carried_over_days)}`}
              accessories={[
                { text: `${formatDays(vacation.entitlement_days)} entitlement`, tooltip: "Vacation days per year" },
                ...(vacation.carried_over_days !== 0
                  ? [{ text: `+${formatDays(vacation.carried_over_days)} carried over` }]
                  : []),
              ]}
              actions={
                <ActionPanel>
                  {recordAction}
                  {common}
                </ActionPanel>
              }
            />
          </List.Section>
          <List.Section title="Coming Up" subtitle={upcoming.length ? countDays(upcoming) : undefined}>
            {upcoming.map((absence) => (
              <AbsenceItem key={absence.date} absence={absence} recordAction={recordAction} onChange={revalidate} />
            ))}
          </List.Section>
          <List.Section title="Taken" subtitle={past.length ? countDays(past) : undefined}>
            {past.map((absence) => (
              <AbsenceItem key={absence.date} absence={absence} recordAction={recordAction} onChange={revalidate} />
            ))}
          </List.Section>
        </>
      ) : null}
    </List>
  );
}

function countDays(absences: Absence[]): string {
  return dayCount(absences.reduce((sum, a) => sum + a.counted_days, 0));
}

function AbsenceItem({
  absence,
  recordAction,
  onChange,
}: {
  absence: Absence;
  recordAction: ReactElement;
  onChange: () => void;
}) {
  const name = absence.category_name ?? absence.category;
  const isVacation = absence.category === "vacation";
  const accessories: List.Item.Accessory[] = [];
  if (absence.over_vacation_allowance) accessories.push({ tag: { value: "Over allowance", color: Color.Red } });
  accessories.push({ text: absence.half_day ? "½ day" : "1 day" });

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Remove ${name} on ${formatDay(absence.date, "short")}?`,
      message: "This syncs to your other Macs.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    await perform(
      "Removing absence…",
      () => removeAbsences(absence.date),
      () => ({ title: "Absence removed" }),
    );
    onChange();
  }

  return (
    <List.Item
      icon={{ source: isVacation ? Icon.Airplane : Icon.Calendar, tintColor: isVacation ? Color.Blue : Color.Purple }}
      title={formatDay(absence.date, "short")}
      subtitle={name}
      keywords={[name, absence.weekday]}
      accessories={accessories}
      actions={
        <ActionPanel>
          {recordAction}
          <Action
            title="Remove Absence"
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
