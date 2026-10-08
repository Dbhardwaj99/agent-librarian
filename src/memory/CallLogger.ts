import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Append-only history of tool calls, one JSON line per call:
 * {"timestamp":"...","tool":"search_memory","params":{...}}
 * Logging is best-effort — a logging failure must never break a tool call.
 *
 * Rotates when the live file reaches maxBytes: the current file is renamed to
 * `<file>.<timestamp>.<uuid>` and a fresh one starts. Archives are kept, not deleted —
 * `gain` includes archives; pruning them is a manual choice.
 */
export class CallLogger {
  constructor(
    private readonly file: string,
    private readonly maxBytes = 5_000_000,
  ) {}

  async log(tool: string, params: unknown): Promise<void> {
    try {
      const line =
        JSON.stringify({ timestamp: new Date().toISOString(), tool, params }) + "\n";
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, line);
      await this.rotateIfNeeded();
    } catch (err) {
      console.error("librarian: call log failed:", err);
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    let size: number;
    try {
      ({ size } = await fs.stat(this.file));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return; // no file yet
      throw err;
    }
    if (size < this.maxBytes) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      await fs.rename(this.file, `${this.file}.${stamp}.${randomUUID()}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // Another writer already rotated the file, including our completed append.
    }
    await fs.appendFile(this.file, "");
  }
}
