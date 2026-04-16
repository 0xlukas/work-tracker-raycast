import { openReadonly } from "./db";
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

export function getSegmentsForDate(date: Date): WorkSegment[] {
  const db = openReadonly();
  try {
    const dayStart = startOfDayZurich(date);
    const dayStartTs = dateToNSTimestamp(dayStart);
    // Match segments whose ZDATE is within 1 second of start of day
    const rows = db
      .prepare(
        `SELECT s.Z_PK, s.ZDATE, s.ZSTARTTIME, s.ZENDTIME, s.ZDURATIONHOURS, s.ZPROJECT, p.ZNAME
       FROM ZWORKSEGMENT s
       LEFT JOIN ZPROJECT p ON s.ZPROJECT = p.Z_PK
       WHERE s.ZDATE >= ? AND s.ZDATE < ?
       ORDER BY s.ZSTARTTIME ASC`,
      )
      .all(dayStartTs - 1, dayStartTs + 86400) as RawSegment[];

    return rows.map(mapSegment);
  } finally {
    db.close();
  }
}

export function getAllSegments(): WorkSegment[] {
  const db = openReadonly();
  try {
    const rows = db
      .prepare(
        `SELECT s.Z_PK, s.ZDATE, s.ZSTARTTIME, s.ZENDTIME, s.ZDURATIONHOURS, s.ZPROJECT, p.ZNAME
       FROM ZWORKSEGMENT s
       LEFT JOIN ZPROJECT p ON s.ZPROJECT = p.Z_PK
       ORDER BY s.ZSTARTTIME ASC`,
      )
      .all() as RawSegment[];

    return rows.map(mapSegment);
  } finally {
    db.close();
  }
}

export function getSegmentsForYear(year: number): WorkSegment[] {
  const db = openReadonly();
  try {
    const yearStartTs = dateToNSTimestamp(new Date(Date.UTC(year, 0, 1)));
    const yearEndTs = dateToNSTimestamp(new Date(Date.UTC(year + 1, 0, 1)));
    const rows = db
      .prepare(
        `SELECT s.Z_PK, s.ZDATE, s.ZSTARTTIME, s.ZENDTIME, s.ZDURATIONHOURS, s.ZPROJECT, p.ZNAME
       FROM ZWORKSEGMENT s
       LEFT JOIN ZPROJECT p ON s.ZPROJECT = p.Z_PK
       WHERE s.ZDATE >= ? AND s.ZDATE < ?
       ORDER BY s.ZSTARTTIME ASC`,
      )
      .all(yearStartTs, yearEndTs) as RawSegment[];

    return rows.map(mapSegment);
  } finally {
    db.close();
  }
}

export function getAllProjects(): Project[] {
  const db = openReadonly();
  try {
    const rows = db.prepare("SELECT Z_PK, ZNAME, ZCREATEDAT FROM ZPROJECT ORDER BY ZNAME ASC").all() as RawProject[];

    return rows.map((r) => ({
      id: r.Z_PK,
      name: r.ZNAME,
      createdAt: nsTimestampToDate(r.ZCREATEDAT),
    }));
  } finally {
    db.close();
  }
}

export function getVacationDaysForYear(year: number): VacationDay[] {
  const db = openReadonly();
  try {
    const yearStartTs = dateToNSTimestamp(new Date(Date.UTC(year, 0, 1)));
    const yearEndTs = dateToNSTimestamp(new Date(Date.UTC(year + 1, 0, 1)));
    const rows = db
      .prepare("SELECT Z_PK, ZDATE, ZISHALFDAY FROM ZVACATIONDAY WHERE ZDATE >= ? AND ZDATE < ? ORDER BY ZDATE ASC")
      .all(yearStartTs, yearEndTs) as RawVacation[];

    return rows.map((r) => ({
      id: r.Z_PK,
      date: nsTimestampToDate(r.ZDATE),
      isHalfDay: r.ZISHALFDAY === 1,
    }));
  } finally {
    db.close();
  }
}

/**
 * Build a vacation lookup: date (start of day Zurich) → isHalfDay
 */
export function buildVacationLookup(vacations: VacationDay[]): Map<number, boolean> {
  const lookup = new Map<number, boolean>();
  for (const v of vacations) {
    const key = startOfDayZurich(v.date).getTime();
    lookup.set(key, v.isHalfDay);
  }
  return lookup;
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
