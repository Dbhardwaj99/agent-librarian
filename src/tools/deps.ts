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
