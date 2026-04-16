import { MenuBarExtra, Icon, open } from "@raycast/api";
import { getSegmentsForYear, getSegmentsForDate, getVacationDaysForYear, buildVacationLookup } from "./lib/queries";
import { readTrackingStartDate } from "./lib/db";
import { WorkHoursCalculator, formatHours, formatBalance } from "./lib/calculator";
import { getZurichComponents, startOfDayZurich } from "./lib/dates";

export default function WorkBalance() {
  let todayHoursStr = "...";
  let expectedHoursStr = "...";
  let todayBalanceStr = "...";
  let ytdBalanceStr = "...";
  let menuTitle = "\u23F1 ...";
  let holidayName: string | null = null;
  let isError = false;
  let errorMessage = "";

  try {
    const now = new Date();
    const { year } = getZurichComponents(now);

    const todaySegments = getSegmentsForDate(now);
    const yearSegments = getSegmentsForYear(year);
    const vacations = getVacationDaysForYear(year);
    const vacationLookup = buildVacationLookup(vacations);

    const calculator = new WorkHoursCalculator([year]);

    // Today
    const { daySummary, todayHours } = calculator.todaySummary(vacationLookup, todaySegments);
    todayHoursStr = formatHours(todayHours);
    expectedHoursStr = formatHours(daySummary.expectedHours);
    todayBalanceStr = formatBalance(todayHours - daySummary.expectedHours);
    holidayName = daySummary.holidayName;

    // Year-to-date
    const trackingStart = readTrackingStartDate();
    const yearStart = trackingStart ?? new Date(Date.UTC(year, 0, 1));
    const today = startOfDayZurich(now);

    const ytdSummary = calculator.periodSummary(yearStart, today, vacationLookup, yearSegments);
    ytdBalanceStr = formatBalance(ytdSummary.balance);

    // Menu bar title: show today's hours compactly
    const h = Math.floor(todayHours);
    const m = Math.round((todayHours - h) * 60);
    menuTitle = `${h}:${m.toString().padStart(2, "0")}`;
  } catch (error) {
    isError = true;
    errorMessage = String(error);
    menuTitle = "\u23F1 \u26A0";
  }

  return (
    <MenuBarExtra icon={Icon.Clock} title={menuTitle} tooltip="Work Tracker Balance">
      {isError ? (
        <MenuBarExtra.Item title={`Error: ${errorMessage}`} icon={Icon.ExclamationMark} />
      ) : (
        <>
          <MenuBarExtra.Section title="Today">
            <MenuBarExtra.Item title={`Worked: ${todayHoursStr}`} icon={Icon.Clock} />
            <MenuBarExtra.Item title={`Expected: ${expectedHoursStr}`} icon={Icon.Target} />
            <MenuBarExtra.Item title={`Balance: ${todayBalanceStr}`} icon={Icon.BarChart} />
            {holidayName && <MenuBarExtra.Item title={holidayName} icon={Icon.Star} />}
          </MenuBarExtra.Section>
          <MenuBarExtra.Section title="Year to Date">
            <MenuBarExtra.Item title={`Balance: ${ytdBalanceStr}`} icon={Icon.BarChart} />
          </MenuBarExtra.Section>
        </>
      )}
    </MenuBarExtra>
  );
}
