// Separate processes share event storage and force rapid log rotation.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore } from "../dist/memory/EventStore.js";
import { CallLogger } from "../dist/memory/CallLogger.js";

if (process.argv[2] === "writer") {
  const [, , , dir, worker] = process.argv;
  const events = new EventStore(path.join(dir, "Stash"));
  const logger = new CallLogger(path.join(dir, "tool-calls.jsonl"), 1);
  await Promise.all(Array.from({ length: 40 }, async (_, i) => {
    const id = `${worker}-${i}`;
    await events.append("Demo", {
      timestamp: "2026-10-08T00:00:00.000Z", agent: "test", type: "fact", summary: id,
    });
    await logger.log("remember", { id });
  }));
} else {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "al-concurrency-"));
  try {
    const workers = await Promise.allSettled(Array.from({ length: 4 }, (_, worker) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "writer", dir, String(worker)], { stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`writer exited ${code}`)));
      }),
    ));
    assert.ok(workers.every((worker) => worker.status === "fulfilled"), "every writer must succeed");
    const pending = await new EventStore(path.join(dir, "Stash")).list("Demo");
    assert.equal(pending.length, 160);
    assert.equal(new Set(pending.map(({ event }) => event.summary)).size, 160);
    const files = (await fs.readdir(dir)).filter((name) => name.startsWith("tool-calls.jsonl"));
    assert.ok(files.length > 1, "must exercise rotation");
    const entries = (await Promise.all(files.map((name) => fs.readFile(path.join(dir, name), "utf8"))))
      .join("").split("\n").filter(Boolean).map(JSON.parse);
    assert.equal(entries.length, 160, "rotation must retain every call exactly once");
    assert.equal(new Set(entries.map(({ params }) => params.id)).size, 160);
    console.log("concurrency: 160 events and logs preserved across 4 processes");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
