import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Append-only history of tool calls, one JSON line per call:
 * {"timestamp":"...","tool":"search_memory","params":{...}}
 * Logging is best-effort — a logging failure must never break a tool call.
 *
 * Rotates when the live file reaches maxBytes: the current file is renamed to
 * `<file>.<timestamp>` and a fresh one starts. Archives are kept, not deleted —
 * `gain` and the dashboard can include archives; pruning them is a manual choice.
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
      await this.rotateIfNeeded();
      await fs.appendFile(this.file, line);
    } catch (err) {
      console.error("memory-mcp: call log failed:", err);
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
    await fs.rename(this.file, `${this.file}.${stamp}`);
  }
}
