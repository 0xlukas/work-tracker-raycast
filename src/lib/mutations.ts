import { openReadWrite } from "./db";
import { dateToNSTimestamp, startOfDayZurich } from "./dates";

// Entity numbers matching Z_PRIMARYKEY
const ENT_PROJECT = 1;
const ENT_WORKSEGMENT = 3;
const ENT_CHANGE = 16001;
const ENT_TRANSACTION = 16002;
const ENT_TRANSACTIONSTRING = 16003;

/**
 * Allocate a new primary key for an entity within a transaction.
 * Must be called within a BEGIN IMMEDIATE transaction.
 */
function allocatePK(db: ReturnType<typeof openReadWrite>, entityNum: number): number {
  const row = db.prepare("SELECT Z_MAX FROM Z_PRIMARYKEY WHERE Z_ENT = ?").get(entityNum) as { Z_MAX: number };
  const newPK = row.Z_MAX + 1;
  db.prepare("UPDATE Z_PRIMARYKEY SET Z_MAX = ? WHERE Z_ENT = ?").run(newPK, entityNum);
  return newPK;
}

/**
 * Write SwiftData history rows for change tracking consistency.
 */
function writeHistory(
  db: ReturnType<typeof openReadWrite>,
  entityNum: number,
  entityPK: number,
  changeType: number, // 0 = insert, 1 = update, 2 = delete
): void {
  const now = dateToNSTimestamp(new Date());

  // Get or create TRANSACTIONSTRING for our author
  const authorName = "raycast-extension";
  let authorRow = db
    .prepare("SELECT Z_PK FROM ATRANSACTIONSTRING WHERE ZVALUE = ?")
    .get(authorName) as { Z_PK: number } | undefined;

  let authorPK: number;
  if (authorRow) {
    authorPK = authorRow.Z_PK;
  } else {
    authorPK = allocatePK(db, ENT_TRANSACTIONSTRING);
    db.prepare("INSERT INTO ATRANSACTIONSTRING (Z_PK, Z_ENT, Z_OPT, ZVALUE) VALUES (?, ?, 1, ?)").run(
      authorPK,
      ENT_TRANSACTIONSTRING,
      authorName,
    );
  }

  // Create ATRANSACTION
  const txPK = allocatePK(db, ENT_TRANSACTION);
  db.prepare(
    "INSERT INTO ATRANSACTION (Z_PK, Z_ENT, Z_OPT, ZBUNDLEID, ZCONTEXTNAME, ZPROCESSID, ZTIMESTAMP) VALUES (?, ?, 1, ?, ?, ?, ?)",
  ).run(txPK, ENT_TRANSACTION, authorPK, authorPK, authorPK, now);

  // Create ACHANGE
  const changePK = allocatePK(db, ENT_CHANGE);
  db.prepare(
    "INSERT INTO ACHANGE (Z_PK, Z_ENT, Z_OPT, ZCHANGETYPE, ZENTITY, ZENTITYPK, ZTRANSACTIONID) VALUES (?, ?, 1, ?, ?, ?, ?)",
  ).run(changePK, ENT_CHANGE, changeType, entityNum, entityPK, txPK);
}

/**
 * Get or create the "Other" project (default project for new entries).
 */
export function getOrCreateOtherProject(): number {
  const db = openReadWrite();
  try {
    const existing = db.prepare("SELECT Z_PK FROM ZPROJECT WHERE ZNAME = ?").get("Other") as
      | { Z_PK: number }
      | undefined;

    if (existing) return existing.Z_PK;

    const insertProject = db.transaction(() => {
      const pk = allocatePK(db, ENT_PROJECT);
      const now = dateToNSTimestamp(new Date());
      db.prepare("INSERT INTO ZPROJECT (Z_PK, Z_ENT, Z_OPT, ZCREATEDAT, ZNAME) VALUES (?, ?, 1, ?, ?)").run(
        pk,
        ENT_PROJECT,
        now,
        "Other",
      );
      writeHistory(db, ENT_PROJECT, pk, 0);
      return pk;
    });

    return insertProject();
  } finally {
    db.close();
  }
}

/**
 * Insert a new work segment.
 */
export function insertSegment(date: Date, startTime: Date, endTime: Date, projectId: number): number {
  const db = openReadWrite();
  try {
    const insert = db.transaction(() => {
      const pk = allocatePK(db, ENT_WORKSEGMENT);
      const dateTs = dateToNSTimestamp(startOfDayZurich(date));
      const startTs = dateToNSTimestamp(startTime);
      const endTs = dateToNSTimestamp(endTime);
      const durationHours = (endTime.getTime() - startTime.getTime()) / 3600000;

      db.prepare(
        `INSERT INTO ZWORKSEGMENT (Z_PK, Z_ENT, Z_OPT, ZPROJECT, ZDATE, ZSTARTTIME, ZENDTIME, ZDURATIONHOURS)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
      ).run(pk, ENT_WORKSEGMENT, projectId, dateTs, startTs, endTs, durationHours);

      writeHistory(db, ENT_WORKSEGMENT, pk, 0);
      return pk;
    });

    return insert();
  } finally {
    db.close();
  }
}

/**
 * Delete a work segment by ID.
 */
export function deleteSegment(segmentId: number): void {
  const db = openReadWrite();
  try {
    const del = db.transaction(() => {
      db.prepare("DELETE FROM ZWORKSEGMENT WHERE Z_PK = ?").run(segmentId);
      writeHistory(db, ENT_WORKSEGMENT, segmentId, 2);
    });

    del();
  } finally {
    db.close();
  }
}
