import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

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

export function getDbPath(): string {
  if (!cachedDbPath) {
    cachedDbPath = resolveDbPath();
  }
  return cachedDbPath;
}

/**
 * Execute a write SQL script against the database using the sqlite3 CLI.
 * Wraps the script in a transaction automatically.
 */
export function executeSQLWrite(script: string): void {
  const dbPath = getDbPath();
  const fullScript = `BEGIN IMMEDIATE;\n${script}\nCOMMIT;`;
  execSync(`sqlite3 "${dbPath}" "${fullScript.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10000,
  });
}

/**
 * Execute a write SQL script and return the output (for queries that produce results).
 */
export function executeSQLWriteWithOutput(script: string): string {
  const dbPath = getDbPath();
  return execSync(`sqlite3 "${dbPath}" "${script.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
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
