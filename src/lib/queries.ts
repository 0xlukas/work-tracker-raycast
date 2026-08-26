import { executeSQL } from "@raycast/utils";
import { getDbPath } from "./db";
import { nsTimestampToDate, dateToNSTimestamp, startOfDayZurich } from "./dates";
import type { AbsenceEntry, AbsenceType, WorkSegment, Project, VacationDay } from "./types";

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
  ZTYPE: string | null;
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

export async function getAllProjects(): Promise<Project[]> {
  const dbPath = getDbPath();

  const rows = await executeSQL<RawProject>(dbPath, "SELECT Z_PK, ZNAME, ZCREATEDAT FROM ZPROJECT ORDER BY ZNAME ASC");

  return rows.map((r) => ({
    id: r.Z_PK,
    name: r.ZNAME,
    createdAt: nsTimestampToDate(r.ZCREATEDAT),
  }));
}

export async function getAbsencesForYear(year: number): Promise<VacationDay[]> {
  const dbPath = getDbPath();
  const yearStartTs = dateToNSTimestamp(new Date(Date.UTC(year, 0, 1)));
  const yearEndTs = dateToNSTimestamp(new Date(Date.UTC(year + 1, 0, 1)));

  const rows = await executeSQL<RawVacation>(
    dbPath,
    `SELECT Z_PK, ZDATE, ZISHALFDAY, ZTYPE FROM ZVACATIONDAY WHERE ZDATE >= ${yearStartTs} AND ZDATE < ${yearEndTs} ORDER BY ZDATE ASC`,
  );

  return rows.map((r) => ({
    id: r.Z_PK,
    date: nsTimestampToDate(r.ZDATE),
    isHalfDay: r.ZISHALFDAY === 1,
    type: resolveAbsenceType(r.ZTYPE),
  }));
}

/**
 * Mirror of `VacationDay.resolvedType`: rows written before schema V2 have no stored
 * type and count as vacation.
 */
function resolveAbsenceType(raw: string | null): AbsenceType {
  return raw === "sick" ? "sick" : "vacation";
}

/**
 * Build an absence lookup: date (start of day Zurich) timestamp -> absence entry.
 */
export function buildAbsenceLookup(absences: VacationDay[]): Map<number, AbsenceEntry> {
  const lookup = new Map<number, AbsenceEntry>();
  for (const a of absences) {
    const key = startOfDayZurich(a.date).getTime();
    lookup.set(key, { type: a.type, isHalfDay: a.isHalfDay });
  }
  return lookup;
}
