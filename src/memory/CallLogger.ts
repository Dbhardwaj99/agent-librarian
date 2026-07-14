import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Append-only history of tool calls, one JSON line per call:
 * {"timestamp":"...","tool":"search_memory","params":{...}}
 * Logging is best-effort — a logging failure must never break a tool call.
 */
export class CallLogger {
  constructor(private readonly file: string) {}

  async log(tool: string, params: unknown): Promise<void> {
    try {
      const line =
        JSON.stringify({ timestamp: new Date().toISOString(), tool, params }) + "\n";
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, line);
    } catch (err) {
      console.error("memory-mcp: call log failed:", err);
    }
  }
}
