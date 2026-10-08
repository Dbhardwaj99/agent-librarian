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
const rotated = (await Promise.all(listing.map((name) => fs.readFile(path.join(dir, name), "utf8"))))
  .join("").split("\n").filter(Boolean).map(JSON.parse);
assert.deepEqual(rotated.map((entry) => entry.params.query).sort(),
  Array.from({ length: 20 }, (_,i) => `q${i}`).sort(), "rotation must retain every call exactly once");

// gain: seed a zero-result search and an exact-duplicate remember, expect both flagged.
const repo = "/tmp/repo";
const archivedLines = [
  { timestamp: "t", tool: "search_memory", params: { repositoryPath: repo, query: "ghost", total: 0, returned: 0, returnedFiles: 0, noteCount: 10, ok: true, durationMs: 12, taskId: "run-1" } },
  { timestamp: "t", tool: "remember", params: { repositoryPath: repo, summary: "Same  Thing", type: "failed_attempt", ok: true, durationMs: 3, taskId: "run-1" } },
].map((l) => JSON.stringify(l)).join("\n") + "\n";
const liveLines = [
  { timestamp: "u", tool: "search_memory", params: { repositoryPath: repo, query: "broad", total: 100, returned: 50, returnedFiles: 25, noteCount: 20, ok: true, durationMs: 30, taskId: "run-1" } },
  { timestamp: "u", tool: "remember", params: { repositoryPath: repo, summary: "same thing", type: "failed_attempt", ok: true, durationMs: 4, taskId: "run-1", unfiled: true } },
  { timestamp: "u", tool: "list_notes", params: { repositoryPath: repo, ok: false, error: "boom", durationMs: 1, taskId: "run-1" } },
].map((l) => JSON.stringify(l)).join("\n") + "\n";
await fs.writeFile(`${file}.seed`, archivedLines);
await fs.writeFile(file, liveLines);
const out = execFileSync("node", [new URL("../dist/gain.js", import.meta.url).pathname], {
  env: { ...process.env, LOG_FILE: file },
  encoding: "utf8",
});
assert.match(out, /ghost/, "zero-result query should appear");
assert.match(out, /2  same thing/, "duplicate summary should be counted");
assert.match(out, /Success rate: 4\/5 measured \(80%\)/);
assert.match(out, /unfiled remembers 1\/2/);
assert.match(out, /search_memory\s+p50\s+12\s+p95\s+12/);
assert.match(out, /Search saturation: 1\/2 capped/);
assert.match(out, /median returned-file diversity 50%/);
assert.match(out, /task IDs 5\/\d+/);
assert.match(out, /failed_attempt/);
assert.match(out, /20\s+\/tmp\/repo/, "latest corpus size should be shown");

await fs.rm(dir, { recursive: true, force: true });
console.log("ok");
