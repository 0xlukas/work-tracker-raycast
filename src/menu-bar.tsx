import { MenuBarExtra, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import { getSegmentsForYear, getSegmentsForDate, getVacationDaysForYear, buildVacationLookup } from "./lib/queries";
import { readTrackingStartDate } from "./lib/db";
import { WorkHoursCalculator, formatHours, formatBalance } from "./lib/calculator";
import { getZurichComponents, startOfDayZurich } from "./lib/dates";

interface BalanceData {
  todayHoursStr: string;
  expectedHoursStr: string;
  todayBalanceStr: string;
  ytdBalanceStr: string;
  menuTitle: string;
  holidayName: string | null;
}

export default function WorkBalance() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const { year } = getZurichComponents(now);

        const [todaySegments, yearSegments, vacations] = await Promise.all([
          getSegmentsForDate(now),
          getSegmentsForYear(year),
          getVacationDaysForYear(year),
        ]);
        const vacationLookup = buildVacationLookup(vacations);

        const calculator = new WorkHoursCalculator([year]);

        // Today
        const { daySummary, todayHours } = calculator.todaySummary(vacationLookup, todaySegments);

        // Year-to-date
        const trackingStart = readTrackingStartDate();
        const yearStart = trackingStart ?? new Date(Date.UTC(year, 0, 1));
        const today = startOfDayZurich(now);
        const ytdSummary = calculator.periodSummary(yearStart, today, vacationLookup, yearSegments);

        // Menu bar title: show today's hours compactly
        const h = Math.floor(todayHours);
        const m = Math.round((todayHours - h) * 60);

        setData({
          todayHoursStr: formatHours(todayHours),
          expectedHoursStr: formatHours(daySummary.expectedHours),
          todayBalanceStr: formatBalance(todayHours - daySummary.expectedHours),
          ytdBalanceStr: formatBalance(ytdSummary.balance),
          menuTitle: `${h}:${m.toString().padStart(2, "0")}`,
          holidayName: daySummary.holidayName,
        });
      } catch (err) {
        setError(String(err));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const menuTitle = data?.menuTitle ?? (error ? "\u26A0" : "...");

  return (
    <MenuBarExtra icon={Icon.Clock} title={menuTitle} tooltip="Work Tracker Balance" isLoading={isLoading}>
      {error ? (
        <MenuBarExtra.Item title={`Error: ${error}`} icon={Icon.ExclamationMark} />
      ) : data ? (
        <>
          <MenuBarExtra.Section title="Today">
            <MenuBarExtra.Item title={`Worked: ${data.todayHoursStr}`} icon={Icon.Clock} />
            <MenuBarExtra.Item title={`Expected: ${data.expectedHoursStr}`} icon={Icon.Target} />
            <MenuBarExtra.Item title={`Balance: ${data.todayBalanceStr}`} icon={Icon.BarChart} />
            {data.holidayName && <MenuBarExtra.Item title={data.holidayName} icon={Icon.Star} />}
          </MenuBarExtra.Section>
          <MenuBarExtra.Section title="Year to Date">
            <MenuBarExtra.Item title={`Balance: ${data.ytdBalanceStr}`} icon={Icon.BarChart} />
          </MenuBarExtra.Section>
        </>
      ) : null}
    </MenuBarExtra>
  );
}
