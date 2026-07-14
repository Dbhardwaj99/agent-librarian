#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ProjectResolver } from "./resolver/ProjectResolver.js";
import { ProviderRegistry } from "./providers/ProviderRegistry.js";
import { MarkdownKnowledgeProvider } from "./providers/MarkdownKnowledgeProvider.js";
import { LineSearchEngine } from "./memory/SearchEngine.js";
import { EventStore } from "./memory/EventStore.js";
import { CallLogger } from "./memory/CallLogger.js";
import type { ToolDeps } from "./tools/deps.js";
import { registerListNotes } from "./tools/listNotes.js";
import { registerReadNote } from "./tools/readNote.js";
import { registerSearchMemory } from "./tools/searchMemory.js";
import { registerRemember } from "./tools/remember.js";
import { registerPendingUpdates } from "./tools/pendingUpdates.js";

// Composition root: everything is wired here, nothing holds global state.
const config = loadConfig();

const deps: ToolDeps = {
  resolver: new ProjectResolver(),
  registry: new ProviderRegistry().register(
    new MarkdownKnowledgeProvider(config.knowledgeRoot, new LineSearchEngine()),
  ),
  events: new EventStore(config.stashRoot),
  logger: new CallLogger(config.logFile, config.logMaxBytes),
};

const server = new McpServer({ name: "local-memory", version: "1.0.0" });
for (const register of [
  registerListNotes,
  registerReadNote,
  registerSearchMemory,
  registerRemember,
  registerPendingUpdates,
]) {
  register(server, deps);
}

await server.connect(new StdioServerTransport());
