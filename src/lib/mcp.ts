/**
 * A minimal client for WorkTracker's assistant server: MCP over Streamable HTTP with
 * plain JSON responses at http://127.0.0.1:<port>/mcp, authorised with a bearer key.
 *
 * The server is stateless, so every tool call is a single `tools/call` request; no
 * `initialize` handshake or session is needed. This file doesn't import @raycast/api,
 * so the tests can run it outside Raycast.
 */

export const DEFAULT_PORT = 47615;
export const PROTOCOL_VERSION = "2025-11-25";

export interface Connection {
  port: number;
  key: string;
}

/**
 * Why a call failed:
 * - `off`: the assistant server is turned off in WorkTracker's settings (or has no key yet);
 * - `unreachable`: nothing answers on the port (WorkTracker isn't running, or another port);
 * - `unauthorized`: the key was refused (replaced with New Key, or a stale override);
 * - `server`: an HTTP or JSON-RPC error;
 * - `tool`: WorkTracker refused the call itself (an overlapping entry, an unknown project, …).
 *   Its message is written for people and can be shown as is.
 */
export type ErrorKind = "off" | "unreachable" | "unauthorized" | "server" | "tool";

export class WorkTrackerError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind,
  ) {
    super(message);
    this.name = "WorkTrackerError";
  }
}

let nextId = 1;

/** Call one of WorkTracker's tools and return its result, decoded from JSON. */
export async function callTool<T>(
  connection: Connection,
  name: string,
  args: Record<string, unknown> = {},
  timeoutMs = 15_000,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${connection.port}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.key}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new WorkTrackerError(
        "WorkTracker didn't answer in time. It may be waiting for you in its window (a sync question, for example).",
        "unreachable",
      );
    }
    throw new WorkTrackerError(`Nothing answers on port ${connection.port}. Is WorkTracker running?`, "unreachable");
  }

  if (response.status === 401) {
    throw new WorkTrackerError(
      "WorkTracker refused the assistant key. If you set one in the extension's preferences, clear it.",
      "unauthorized",
    );
  }
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).trim();
    throw new WorkTrackerError(`WorkTracker answered ${response.status}${text ? ` (${text})` : ""}.`, "server");
  }

  let message: JsonRpcResponse;
  try {
    message = (await response.json()) as JsonRpcResponse;
  } catch {
    throw new WorkTrackerError("WorkTracker sent an answer that isn't JSON.", "server");
  }
  if (message.error) {
    throw new WorkTrackerError(message.error.message || `JSON-RPC error ${message.error.code}`, "server");
  }
  const result = message.result;
  const text = result?.content?.find((item) => item.type === "text")?.text ?? "";
  if (!result || result.isError) {
    throw new WorkTrackerError(text || `${name} failed.`, "tool");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WorkTrackerError(`${name} returned something that isn't JSON.`, "server");
  }
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: { content?: { type: string; text?: string }[]; isError?: boolean };
  error?: { code: number; message: string };
}
