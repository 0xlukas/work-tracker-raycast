import { executeSQL } from "@raycast/utils";
import { getDbPath } from "./db";
import { nsTimestampToDate, dateToNSTimestamp, startOfDayZurich } from "./dates";
import type { WorkSegment, Project, VacationDay } from "./types";

interface RawSegment {
  Z_PK: number;
  ZDATE: number;
  ZSTARTTIME: number;
  ZENDTIME: number;
  ZDURATIONHOURS: number;
  ZPROJECT: number | null;
  ZNAME: string | null;
}

interface RawProject {
  Z_PK: number;
  ZNAME: string;
  ZCREATEDAT: number;
}

interface RawVacation {
  Z_PK: number;
  ZDATE: number;
  ZISHALFDAY: number;
}

function mapSegment(r: RawSegment): WorkSegment {
  return {
    id: r.Z_PK,
    date: nsTimestampToDate(r.ZDATE),
    startTime: nsTimestampToDate(r.ZSTARTTIME),
    endTime: nsTimestampToDate(r.ZENDTIME),
    durationHours: r.ZDURATIONHOURS,
    projectId: r.ZPROJECT,
    projectName: r.ZNAME,
  };
}

export async function getSegmentsForDate(date: Date): Promise<WorkSegment[]> {
  const dbPath = getDbPath();
  const dayStart = startOfDayZurich(date);
  const dayStartTs = dateToNSTimestamp(dayStart);

  const rows = await executeSQL<RawSegment>(
    dbPath,
    `SELECT s.Z_PK, s.ZDATE, s.ZSTARTTIME, s.ZENDTIME, s.ZDURATIONHOURS, s.ZPROJECT, p.ZNAME
     FROM ZWORKSEGMENT s
     LEFT JOIN ZPROJECT p ON s.ZPROJECT = p.Z_PK
     WHERE s.ZDATE >= ${dayStartTs - 1} AND s.ZDATE < ${dayStartTs + 86400}
     ORDER BY s.ZSTARTTIME ASC`,
  );

  return rows.map(mapSegment);
}

export async function getSegmentsForYear(year: number): Promise<WorkSegment[]> {
  const dbPath = getDbPath();
  const yearStartTs = dateToNSTimestamp(new Date(Date.UTC(year, 0, 1)));
  const yearEndTs = dateToNSTimestamp(new Date(Date.UTC(year + 1, 0, 1)));

  const rows = await executeSQL<RawSegment>(
    dbPath,
    `SELECT s.Z_PK, s.ZDATE, s.ZSTARTTIME, s.ZENDTIME, s.ZDURATIONHOURS, s.ZPROJECT, p.ZNAME
     FROM ZWORKSEGMENT s
     LEFT JOIN ZPROJECT p ON s.ZPROJECT = p.Z_PK
     WHERE s.ZDATE >= ${yearStartTs} AND s.ZDATE < ${yearEndTs}
     ORDER BY s.ZSTARTTIME ASC`,
  );

  return rows.map(mapSegment);
}

export async function getAllProjects(): Promise<Project[]> {
  const dbPath = getDbPath();

  const rows = await executeSQL<RawProject>(
    dbPath,
    "SELECT Z_PK, ZNAME, ZCREATEDAT FROM ZPROJECT ORDER BY ZNAME ASC",
  );

  return rows.map((r) => ({
    id: r.Z_PK,
    name: r.ZNAME,
    createdAt: nsTimestampToDate(r.ZCREATEDAT),
  }));
}

export async function getVacationDaysForYear(year: number): Promise<VacationDay[]> {
  const dbPath = getDbPath();
  const yearStartTs = dateToNSTimestamp(new Date(Date.UTC(year, 0, 1)));
  const yearEndTs = dateToNSTimestamp(new Date(Date.UTC(year + 1, 0, 1)));

  const rows = await executeSQL<RawVacation>(
    dbPath,
    `SELECT Z_PK, ZDATE, ZISHALFDAY FROM ZVACATIONDAY WHERE ZDATE >= ${yearStartTs} AND ZDATE < ${yearEndTs} ORDER BY ZDATE ASC`,
  );

  return rows.map((r) => ({
    id: r.Z_PK,
    date: nsTimestampToDate(r.ZDATE),
    isHalfDay: r.ZISHALFDAY === 1,
  }));
}

/**
 * Build a vacation lookup: date (start of day Zurich) timestamp -> isHalfDay
 */
export function buildVacationLookup(vacations: VacationDay[]): Map<number, boolean> {
  const lookup = new Map<number, boolean>();
  for (const v of vacations) {
    const key = startOfDayZurich(v.date).getTime();
    lookup.set(key, v.isHalfDay);
  }
  return lookup;
}
