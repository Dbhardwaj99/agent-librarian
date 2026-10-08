#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, packageRoot } from "./config.js";
import { createDeps } from "./core.js";
import { registerListNotes } from "./tools/listNotes.js";
import { registerReadNote } from "./tools/readNote.js";
import { registerSearchMemory } from "./tools/searchMemory.js";
import { registerRemember } from "./tools/remember.js";
import { registerPendingUpdates } from "./tools/pendingUpdates.js";

// Composition root: everything is wired here, nothing holds global state.
const deps = createDeps(loadConfig());

const { version } = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const server = new McpServer({ name: "librarian", version });
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
