import { getPreferenceValues } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_PORT, WorkTrackerError, type Connection } from "./mcp";

const run = promisify(execFile);

/** The installed WorkTracker's bundle ID, which is also its preferences domain. */
export const WORKTRACKER_BUNDLE_ID = "com.worktracker.app";

async function readDefault(key: string): Promise<string | undefined> {
  try {
    const { stdout } = await run("/usr/bin/defaults", ["read", WORKTRACKER_BUNDLE_ID, key], { timeout: 5_000 });
    const value = stdout.trim();
    return value === "" ? undefined : value;
  } catch {
    return undefined; // Not set.
  }
}

/** A port as WorkTracker accepts it (it ignores anything outside 1024–65535). */
export function parsePort(text: string | undefined): number | undefined {
  if (!text || !/^\d+$/.test(text.trim())) return undefined;
  const port = Number(text.trim());
  return port >= 1024 && port <= 65535 ? port : undefined;
}

/**
 * The extension's override of WorkTracker's port and key, for another build such as a
 * test build. Both together or neither: a port alone would send the installed app's key
 * to whatever listens there. Values are trimmed, as typed into Raycast's preferences.
 */
export function parseOverride(serverKey: string | undefined, serverPort: string | undefined): Connection | undefined {
  const key = serverKey?.trim() ?? "";
  const portText = serverPort?.trim() ?? "";
  if (!key && !portText) return undefined;
  if (!key || !portText) {
    throw new WorkTrackerError(
      "Set both Assistant Key and Port in the extension's preferences, or leave both empty to use WorkTracker's own.",
      "server",
    );
  }
  const port = parsePort(portText);
  if (port === undefined) {
    throw new WorkTrackerError(
      `The port "${portText}" in the extension's preferences isn't valid. Use 1024–65535, or leave it empty.`,
      "server",
    );
  }
  return { port, key };
}

let explicit: Connection | undefined;

/** Use exactly this connection, never WorkTracker's preferences (for the live tests). */
export function setExplicitConnection(connection: Connection | undefined) {
  explicit = connection;
  cached = undefined;
}

/**
 * Where WorkTracker's assistant server listens and its key. Read from WorkTracker's own
 * preferences (read only), unless the extension's preferences override both.
 */
export async function resolveConnection(): Promise<Connection> {
  if (explicit) return explicit;
  // A view makes several calls at once; read the preferences once for all of them.
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.connection;
  const connection = await readConnection();
  cached = { connection, at: Date.now() };
  return connection;
}

const CACHE_MS = 5_000;
let cached: { connection: Connection; at: number } | undefined;

async function readConnection(): Promise<Connection> {
  const preferences = getPreferenceValues<Preferences>();
  const override = parseOverride(preferences.serverKey, preferences.serverPort);
  if (override) return override;

  const [enabled, key, port] = await Promise.all([
    readDefault("assistantServerEnabled"),
    readDefault("assistantServerToken"),
    readDefault("assistantServerPort"),
  ]);
  if (enabled !== "1" || !key) {
    throw new WorkTrackerError(
      "Turn on WorkTracker › Settings › Assistants › “Let AI assistants use Work Tracker”.",
      "off",
    );
  }
  return { port: parsePort(port) ?? DEFAULT_PORT, key };
}
