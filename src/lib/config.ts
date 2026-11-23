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
 * Where WorkTracker's assistant server listens and its key. Read from WorkTracker's own
 * preferences (read only), unless the extension's preferences override them.
 */
export async function resolveConnection(): Promise<Connection> {
  const preferences = getPreferenceValues<Preferences>();
  const keyOverride = preferences.serverKey?.trim();
  const portOverride = preferences.serverPort?.trim();
  if (portOverride && parsePort(portOverride) === undefined) {
    throw new WorkTrackerError(
      `The port "${portOverride}" in the extension's preferences isn't valid. Use 1024–65535, or leave it empty.`,
      "server",
    );
  }

  const [enabled, storedKey, storedPort] = await Promise.all([
    keyOverride ? Promise.resolve(undefined) : readDefault("assistantServerEnabled"),
    keyOverride ? Promise.resolve(undefined) : readDefault("assistantServerToken"),
    portOverride ? Promise.resolve(undefined) : readDefault("assistantServerPort"),
  ]);
  const key = keyOverride || storedKey;
  if (!keyOverride && (enabled !== "1" || !key)) {
    throw new WorkTrackerError(
      "Turn on WorkTracker › Settings › Assistants › “Let AI assistants use Work Tracker”.",
      "off",
    );
  }
  return {
    port: parsePort(portOverride) ?? parsePort(storedPort) ?? DEFAULT_PORT,
    key: key ?? "",
  };
}
