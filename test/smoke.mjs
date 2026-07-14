// Smallest end-to-end check: spawns the built server against a temp fixture
// and exercises every tool. Run with `npm test`.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "memory-mcp-"));
await fs.mkdir(path.join(root, "Knowledge/Kuku/payments"), { recursive: true });
await fs.writeFile(
  path.join(root, "Knowledge/Kuku/payments/iap.md"),
  "# IAP\n\n## StoreManager\n\nStoreManager handles all purchases.\n",
);

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: [new URL("../dist/server.js", import.meta.url).pathname],
    env: { ...process.env, MEMORY_ROOT: root },
  }),
);

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  assert.equal(res.isError ?? false, false, `${name} errored: ${res.content?.[0]?.text}`);
  return res.content[0].text;
};
const repositoryPath = "/Users/divyansh/Documents/kukufm-ios";

// list_notes
const notes = JSON.parse(await call("list_notes", { repositoryPath }));
assert.deepEqual(notes.notes, ["payments/iap.md"]);

// read_note
assert.match(await call("read_note", { repositoryPath, note: "payments/iap.md" }), /StoreManager handles/);

// read_note path traversal is rejected
const evil = await client.callTool({
  name: "read_note",
  arguments: { repositoryPath, note: "../../secrets" },
});
assert.equal(evil.isError, true, "traversal must be rejected");

// search_memory
const search = JSON.parse(await call("search_memory", { repositoryPath, query: "purchases" }));
assert.equal(search.results.length, 1);
assert.equal(search.results[0].heading, "StoreManager");
assert.equal(search.results[0].file, "payments/iap.md");

// remember + pending_updates
await call("remember", {
  repositoryPath,
  agent: "smoke-test",
  type: "architecture_change",
  summary: "StoreManager was made thread-safe.",
  files: ["StoreManager.swift"],
  confidence: 0.95,
  tags: ["concurrency"],
});
const pending = JSON.parse(await call("pending_updates", { repositoryPath }));
assert.equal(pending.count, 1);
assert.equal(pending.pending[0].event.summary, "StoreManager was made thread-safe.");
assert.match(pending.pending[0].file, /\.yaml$/);

// unknown repo fails cleanly
const unknown = await client.callTool({
  name: "list_notes",
  arguments: { repositoryPath: "/tmp/not-a-repo" },
});
assert.equal(unknown.isError, true);

// call log recorded every successful call with params and timestamp
const log = (await fs.readFile(path.join(root, "MCP/logs/tool-calls.jsonl"), "utf8"))
  .trim().split("\n").map(JSON.parse);
assert.ok(log.length >= 5, `expected >=5 log lines, got ${log.length}`);
assert.match(log[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(log[0].tool, "list_notes");
assert.equal(log[0].params.repositoryPath, repositoryPath);

// canonical knowledge untouched
const kukuFiles = await fs.readdir(path.join(root, "Knowledge/Kuku/payments"));
assert.deepEqual(kukuFiles, ["iap.md"]);

await client.close();
await fs.rm(root, { recursive: true, force: true });
console.log("smoke: all checks passed");
