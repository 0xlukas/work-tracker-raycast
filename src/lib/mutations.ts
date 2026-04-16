import { execSync } from "child_process";
import { getDbPath } from "./db";
import { dateToNSTimestamp, startOfDayZurich } from "./dates";

/**
 * Execute a SQL script against the database using the sqlite3 CLI.
 * Used for write operations since executeSQL from @raycast/utils is read-only.
 */
function runSQL(script: string): void {
  const dbPath = getDbPath();
  // Use heredoc-style input to avoid shell escaping issues
  execSync(`sqlite3 '${dbPath}' <<'ENDSQL'\n${script}\nENDSQL`, {
    encoding: "utf-8",
    shell: "/bin/bash",
    timeout: 10000,
  });
}

/**
 * Insert a new work segment using pure SQL via sqlite3 CLI.
 * Allocates PKs using subqueries within a single transaction.
 */
export function insertSegment(date: Date, startTime: Date, endTime: Date, projectId: number): void {
  const dateTs = dateToNSTimestamp(startOfDayZurich(date));
  const startTs = dateToNSTimestamp(startTime);
  const endTs = dateToNSTimestamp(endTime);
  const durationHours = (endTime.getTime() - startTime.getTime()) / 3600000;

  const script = `
BEGIN IMMEDIATE;
UPDATE Z_PRIMARYKEY SET Z_MAX = Z_MAX + 1 WHERE Z_ENT = 3;
INSERT INTO ZWORKSEGMENT (Z_PK, Z_ENT, Z_OPT, ZPROJECT, ZDATE, ZSTARTTIME, ZENDTIME, ZDURATIONHOURS)
  VALUES ((SELECT Z_MAX FROM Z_PRIMARYKEY WHERE Z_ENT = 3), 3, 1, ${projectId}, ${dateTs}, ${startTs}, ${endTs}, ${durationHours});
COMMIT;
`;

  runSQL(script);
}

/**
 * Delete a work segment by ID.
 */
export function deleteSegment(segmentId: number): void {
  const script = `
BEGIN IMMEDIATE;
DELETE FROM ZWORKSEGMENT WHERE Z_PK = ${segmentId};
COMMIT;
`;

  runSQL(script);
}

/**
 * Get or create the "Other" project. Returns the project ID.
 * Uses sqlite3 CLI for the conditional insert.
 */
export function getOrCreateOtherProject(): number {
  const dbPath = getDbPath();

  // First try to read the existing project
  try {
    const result = execSync(
      `sqlite3 '${dbPath}' "SELECT Z_PK FROM ZPROJECT WHERE ZNAME = 'Other' LIMIT 1;"`,
      { encoding: "utf-8", shell: "/bin/bash", timeout: 5000 },
    ).trim();

    if (result) {
      return parseInt(result);
    }
  } catch {
    // Not found, create it
  }

  // Create the "Other" project
  const now = dateToNSTimestamp(new Date());
  const script = `
BEGIN IMMEDIATE;
UPDATE Z_PRIMARYKEY SET Z_MAX = Z_MAX + 1 WHERE Z_ENT = 1;
INSERT INTO ZPROJECT (Z_PK, Z_ENT, Z_OPT, ZCREATEDAT, ZNAME)
  VALUES ((SELECT Z_MAX FROM Z_PRIMARYKEY WHERE Z_ENT = 1), 1, 1, ${now}, 'Other');
COMMIT;
`;

  runSQL(script);

  // Read back the PK
  const result = execSync(
    `sqlite3 '${dbPath}' "SELECT Z_PK FROM ZPROJECT WHERE ZNAME = 'Other' LIMIT 1;"`,
    { encoding: "utf-8", shell: "/bin/bash", timeout: 5000 },
  ).trim();

  return parseInt(result);
}
