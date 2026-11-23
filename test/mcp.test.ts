import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { callTool, WorkTrackerError } from "../src/lib/mcp";

// A fake assistant server that answers like WorkTracker's (AssistantServer.swift).
let server: http.Server;
let port: number;
const KEY = "test-key";
const requests: { headers: http.IncomingHttpHeaders; body: { method: string; params: { name: string } } }[] = [];

before(async () => {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      if (request.headers.authorization !== `Bearer ${KEY}`) {
        response.writeHead(401, { "WWW-Authenticate": "Bearer" }).end("Unauthorized\n");
        return;
      }
      const message = JSON.parse(body);
      requests.push({ headers: request.headers, body: message });
      const reply = (result: unknown) =>
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, ...(result as object) }));
      switch (message.params.name) {
        case "get_overview":
          return reply({ result: { content: [{ type: "text", text: '{"today":{"worked":1.5}}' }], isError: false } });
        case "slow_tool":
          return; // never answers
        case "add_entries":
          return reply({ result: { content: [{ type: "text", text: "It overlaps 08:00–12:00." }], isError: true } });
        default:
          return reply({ error: { code: -32602, message: `Unknown tool: ${message.params.name}` } });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("calls a tool with one JSON-RPC request and decodes its result", async () => {
  const result = await callTool<{ today: { worked: number } }>({ port, key: KEY }, "get_overview");
  assert.equal(result.today.worked, 1.5);
  const last = requests.at(-1)!;
  assert.equal(last.body.method, "tools/call");
  assert.equal(last.body.params.name, "get_overview");
  assert.equal(last.headers["content-type"], "application/json");
  assert.equal(last.headers.host, `127.0.0.1:${port}`);
  assert.equal(last.headers.origin, undefined); // WorkTracker refuses foreign origins
});

async function failure(promise: Promise<unknown>): Promise<WorkTrackerError> {
  const error = await promise.then(
    () => assert.fail("expected an error"),
    (error: unknown) => error,
  );
  assert.ok(error instanceof WorkTrackerError);
  return error;
}

test("a refused call is a tool error with WorkTracker's message", async () => {
  const error = await failure(callTool({ port, key: KEY }, "add_entries", { entries: [] }));
  assert.equal(error.kind, "tool");
  assert.equal(error.message, "It overlaps 08:00–12:00.");
});

test("a wrong key is unauthorized", async () => {
  assert.equal((await failure(callTool({ port, key: "wrong" }, "get_overview"))).kind, "unauthorized");
});

test("a tool this WorkTracker doesn't have asks for an update", async () => {
  const error = await failure(callTool({ port, key: KEY }, "no_such_tool"));
  assert.equal(error.kind, "outdated");
  assert.match(error.message, /Update WorkTracker/);
});

test("a timed-out write may still have been saved", async () => {
  const write = await failure(callTool({ port, key: KEY }, "slow_tool", {}, { write: true, timeoutMs: 100 }));
  assert.equal(write.kind, "unreachable");
  assert.match(write.message, /may still have saved/);
  const read = await failure(callTool({ port, key: KEY }, "slow_tool", {}, { timeoutMs: 100 }));
  assert.doesNotMatch(read.message, /saved/);
});

test("nothing listening is unreachable", async () => {
  const closed = http.createServer();
  await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
  const freePort = (closed.address() as AddressInfo).port;
  await new Promise<void>((resolve) => closed.close(() => resolve()));
  assert.equal((await failure(callTool({ port: freePort, key: KEY }, "get_overview"))).kind, "unreachable");
});
