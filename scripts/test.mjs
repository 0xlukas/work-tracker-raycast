#!/usr/bin/env node
// Bundle the tests with esbuild (@raycast/api is replaced by test/stubs/raycast-api.ts)
// and run them with node's test runner.
//
//   npm test                      # unit tests and the MCP client against a fake server
//   WORKTRACKER_TEST_PORT=47616 WORKTRACKER_TEST_KEY=… npm test
//                                 # also the live tests, against a WorkTracker *test build*
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = fs
  .readdirSync(path.join(root, "test"))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => path.join(root, "test", name));
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "work-tracker-raycast-tests-"));

try {
  await build({
    entryPoints: tests,
    outdir,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    alias: { "@raycast/api": path.join(root, "test/stubs/raycast-api.ts") },
    logLevel: "warning",
  });
  const files = fs.readdirSync(outdir).map((name) => path.join(outdir, name));
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...files], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(outdir, { recursive: true, force: true });
}
