import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ProjectResolver } from "../resolver/ProjectResolver.js";
import type { ProviderRegistry } from "../providers/ProviderRegistry.js";
import type { EventStore } from "../memory/EventStore.js";
import type { CallLogger } from "../memory/CallLogger.js";

/** Everything a tool needs, injected by server.ts. */
export interface ToolDeps {
  resolver: ProjectResolver;
  registry: ProviderRegistry;
  events: EventStore;
  logger: CallLogger;
}

export type RegisterTool = (server: McpServer, deps: ToolDeps) => void;

/** Standard MCP text response wrapping a JSON payload. */
export function json(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Runs a tool body and always logs the outcome — {ok:true, ...extra} on success,
 * {ok:false, error} on failure — then rethrows so the MCP client still sees the
 * error. Without this, a thrown error (e.g. an unresolvable repositoryPath) left
 * the log showing only the attempted call, with no way to tell it had failed.
 */
export async function logged<T>(
  logger: CallLogger,
  tool: string,
  baseParams: Record<string, unknown>,
  fn: () => Promise<{ result: T; logExtra?: Record<string, unknown> }>,
): Promise<T> {
  try {
    const { result, logExtra } = await fn();
    await logger.log(tool, { ...baseParams, ok: true, ...logExtra });
    return result;
  } catch (err) {
    await logger.log(tool, {
      ...baseParams,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
