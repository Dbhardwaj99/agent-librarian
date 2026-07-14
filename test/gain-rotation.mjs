// Checks the two non-trivial bits added for gain/rotation. Run: node test/gain-rotation.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CallLogger } from "../dist/memory/CallLogger.js";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gain-"));
const file = path.join(dir, "tool-calls.jsonl");

// Rotation: tiny cap forces a rename once the live file fills.
const logger = new CallLogger(file, 200);
for (let i = 0; i < 20; i++) await logger.log("search_memory", { query: `q${i}`, total: 1 });
const listing = await fs.readdir(dir);
assert.ok(listing.some((f) => f.startsWith("tool-calls.jsonl.")), "expected a rotated archive");
assert.ok((await fs.stat(file)).size < 200 * 2, "live file should be small after rotation");

// gain: seed a zero-result search and an exact-duplicate remember, expect both flagged.
const repo = "/tmp/repo";
const lines = [
  { timestamp: "t", tool: "search_memory", params: { repositoryPath: repo, query: "ghost", total: 0 } },
  { timestamp: "t", tool: "remember", params: { repositoryPath: repo, summary: "Same  Thing" } },
  { timestamp: "t", tool: "remember", params: { repositoryPath: repo, summary: "same thing" } },
].map((l) => JSON.stringify(l)).join("\n") + "\n";
await fs.writeFile(file, lines);
const out = execFileSync("node", [new URL("../dist/gain.js", import.meta.url).pathname], {
  env: { ...process.env, LOG_FILE: file },
  encoding: "utf8",
});
assert.match(out, /ghost/, "zero-result query should appear");
assert.match(out, /2  same thing/, "duplicate summary should be counted");

await fs.rm(dir, { recursive: true, force: true });
console.log("ok");
