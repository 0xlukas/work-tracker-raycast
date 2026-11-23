#!/usr/bin/env node
// Copy WorkTracker's daily quotes (WorkTracker/Sources/Models/DailyQuote.swift) into
// src/lib/quotes.json, so Daily Quote shows the same quote as the app.
//
//   npm run sync-quotes                      # reads ~/code/personal/work-tracker
//   npm run sync-quotes -- <work-tracker repo>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = process.argv[2] ?? path.join(os.homedir(), "code/personal/work-tracker");
const source = path.join(repo, "WorkTracker/Sources/Models/DailyQuote.swift");
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/quotes.json");

const swift = fs.readFileSync(source, "utf8");
const literal = String.raw`"((?:[^"\\]|\\.)*)"`;
const pattern = new RegExp(
  String.raw`DailyQuote\(\s*text:\s*${literal},\s*thinker:\s*${literal},\s*source:\s*(?:nil|${literal})\s*\)`,
  "g",
);

function unescape(text) {
  return text.replace(/\\(u\{([0-9a-fA-F]+)\}|.)/g, (_, escape, hex) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return { n: "\n", t: "\t", 0: "\0" }[escape] ?? escape;
  });
}

const quotes = [...swift.matchAll(pattern)].map((match) => ({
  text: unescape(match[1]),
  thinker: unescape(match[2]),
  source: match[3] === undefined ? null : unescape(match[3]),
}));
const expected = (swift.match(/DailyQuote\(\s*text:/g) ?? []).length;
if (quotes.length === 0 || quotes.length !== expected) {
  console.error(`Read ${quotes.length} of ${expected} quotes from ${source}; the Swift format changed.`);
  process.exit(1);
}
fs.writeFileSync(target, JSON.stringify(quotes, null, 2) + "\n");
console.log(`Wrote ${quotes.length} quotes to ${path.relative(process.cwd(), target)}`);
