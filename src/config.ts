import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Filesystem layout. Everything is derived from the Memory root, which
 * defaults to the parent of the MCP folder this server lives in
 * (Memory/MCP/dist/config.js -> Memory/). Override with MEMORY_ROOT.
 */
export interface Config {
  /** Root of canonical knowledge, e.g. Memory/Knowledge. Read-only. */
  knowledgeRoot: string;
  /** Root of the event stash, e.g. Memory/Knowledge/Stash. Append-only. */
  stashRoot: string;
  /** JSONL history of tool calls, e.g. Memory/MCP/logs/tool-calls.jsonl. */
  logFile: string;
  /** Rotate the log once it reaches this many bytes. Override with LOG_MAX_BYTES. */
  logMaxBytes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const memoryRoot =
    env.MEMORY_ROOT ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const knowledgeRoot = env.KNOWLEDGE_ROOT ?? path.join(memoryRoot, "Knowledge");
  // ponytail: Stash lives inside Knowledge/ on disk today; move it by setting STASH_ROOT.
  const stashRoot = env.STASH_ROOT ?? path.join(knowledgeRoot, "Stash");
  const logFile =
    env.LOG_FILE ?? path.join(memoryRoot, "MCP", "logs", "tool-calls.jsonl");
  const logMaxBytes = Number(env.LOG_MAX_BYTES) || 5_000_000;
  return { knowledgeRoot, stashRoot, logFile, logMaxBytes };
}
