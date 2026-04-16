import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const APP_DEFAULTS_DOMAIN = "com.fbg.work-tracker";
const DEFAULT_DIR_NAME = "WorkTracker";
const STORE_FILENAME = "WorkTracker.store";

/**
 * Resolve the database path dynamically:
 * 1. Check UserDefaults for a custom data directory
 * 2. Fall back to ~/Library/Application Support/WorkTracker/WorkTracker.store
 */
function resolveDbPath(): string {
  // Try reading custom directory from UserDefaults
  try {
    const customDir = execSync(`defaults read ${APP_DEFAULTS_DOMAIN} customDataDirectory 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    if (customDir) {
      const customPath = path.join(customDir, STORE_FILENAME);
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    }
  } catch {
    // defaults read failed — no custom directory set
  }

  // Fall back to default Application Support location
  const defaultPath = path.join(os.homedir(), "Library", "Application Support", DEFAULT_DIR_NAME, STORE_FILENAME);
  return defaultPath;
}

let cachedDbPath: string | null = null;

function getDbPath(): string {
  if (!cachedDbPath) {
    cachedDbPath = resolveDbPath();
  }
  return cachedDbPath;
}

/**
 * Open a read-only database connection.
 * Caller is responsible for closing the connection.
 */
export function openReadonly(): Database.Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath, { readonly: true });
  db.pragma("busy_timeout = 5000");
  return db;
}

/**
 * Open a read-write database connection.
 * Caller is responsible for closing the connection.
 */
export function openReadWrite(): Database.Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  db.pragma("busy_timeout = 5000");
  return db;
}

/**
 * Read the tracking start date from UserDefaults.
 * Returns null if not set.
 */
export function readTrackingStartDate(): Date | null {
  try {
    const raw = execSync(`defaults read ${APP_DEFAULTS_DOMAIN} trackingStartDate 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    if (raw) {
      // Format: "2026-03-31 22:00:00 +0000"
      return new Date(raw.replace(" +0000", "Z").replace(" ", "T"));
    }
  } catch {
    // Not set
  }
  return null;
}
