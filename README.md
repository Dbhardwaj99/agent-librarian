# Local Memory MCP

A local, offline MCP server that gives AI coding agents (Claude Code, Codex CLI, Cursor, …) read access to canonical project knowledge and an append-only way to propose updates. No LLM logic, no database, no network — just a thin, stateless interface over the `Memory/` directory.

## How it works

```text
Memory/
├── Knowledge/            ← canonical knowledge (READ-ONLY to this server)
│   ├── Kuku/             ← Markdown docs for kukufm-ios
│   ├── Duskara/          ← Markdown docs for Quest For Duskara
│   └── Stash/            ← proposed updates (APPEND-ONLY)
│       ├── Kuku/         ←   one immutable YAML file per event
│       └── Duskara/
└── MCP/                  ← this server
```

Agents read knowledge through the tools below. They never edit it. When an agent learns something, it calls `remember`, which writes an immutable YAML event into the Stash. A separate Librarian process (out of scope here) folds events into canonical knowledge later.

## Tools

Every tool takes `repositoryPath` — the absolute path of the repo the agent is working in — and resolves it to a knowledge project internally. Every tool also accepts an optional `taskId`; reuse one ID across a task to connect searches, reads, writes, and outcomes in the log.

| Tool | Purpose |
|------|---------|
| `list_notes(repositoryPath)` | Every Markdown document for the project |
| `read_note(repositoryPath, note)` | Full content of one note (path from `list_notes`) |
| `search_memory(repositoryPath, query)` | Case-insensitive text search; returns corpus note count, file, nearest heading, snippet, line |
| `remember(repositoryPath, …event)` | Append an immutable update event to the Stash |
| `pending_updates(repositoryPath)` | All unprocessed events for the project, oldest first |

`remember` accepts: `agent`, `type`, `summary` (required); `details`, `files`, `confidence` (0–1), `branch`, `tags` (optional). Use `failed_attempt`, `gotcha`, `knowledge_correction`, or `abstained` when a durable negative lesson matters; successful changes keep their normal domain type. The server stamps the timestamp and derives the filename from it, e.g. `2026-07-14T14-32-11-123Z.yaml`. Files are written with the exclusive flag — an existing event can never be overwritten.

If `repositoryPath` doesn't resolve to a known project, `remember` never throws the event away: it falls back to `Knowledge/Stash/Unfiled/`, keeping the original `repositoryPath` on the event so it can be re-filed by hand later (response includes `unfiled: true`). Every other tool still errors cleanly on an unknown repo — there's nothing to list or read for a project that isn't registered.

If `type` is `"knowledge_correction"` and `tags` are given, the response includes `possiblyAffected`: other notes matching those tags that weren't listed in `files`. A correction is only useful if it reaches every note repeating the now-wrong fact — this is a nudge toward those notes at correction time instead of relying on a later pass to remember to look for them.

## Setup

```bash
cd Memory/MCP
npm install
npm run build
```

Register with Claude Code:

```bash
claude mcp add -s user local-memory -- node /Users/aaa/Documents/Memory/MCP/dist/server.js
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "local-memory": {
      "command": "node",
      "args": ["/Users/aaa/Documents/Memory/MCP/dist/server.js"]
    }
  }
}
```

Environment overrides (all optional): `MEMORY_ROOT` (defaults to the `Memory/` folder this server lives in), `KNOWLEDGE_ROOT`, `STASH_ROOT`, `LOG_FILE`.

## Call log

Every tool call is appended to `Memory/MCP/logs/tool-calls.jsonl`, one JSON line per call with `timestamp`, `tool`, and `params`. New entries include `ok: true` on success or `ok: false` plus `error` on failure, and `durationMs` either way. Searches also log corpus note count, total/returned result counts, and returned-file diversity. When supplied, `taskId` appears on every tool's log entry. `remember` logs its summary and structured metadata but not the long `details` body, which already lives in the Stash. Logging is best-effort and never fails a tool call. Inspect with `tail logs/tool-calls.jsonl`, open `logs/dashboard.html`, or run `npm run gain` to audit the live and rotated logs together.

## Testing

```bash
npm test
```

Builds and runs `test/smoke.mjs`, which spawns the real server against a throwaway fixture and exercises every tool, including path-traversal rejection and unknown-repo errors.

## Architecture

```text
src/
├── server.ts                 composition root — all wiring, no logic
├── config.ts                 filesystem layout (env-overridable)
├── types/                    shared types
├── resolver/
│   └── ProjectResolver.ts    repo path → project name (the ONLY project-specific code)
├── providers/
│   ├── KnowledgeProvider.ts  interface every knowledge source implements
│   ├── MarkdownKnowledgeProvider.ts  read-only Markdown over Knowledge/
│   └── ProviderRegistry.ts   holds all providers; tools iterate it
├── memory/
│   ├── SearchEngine.ts       pluggable search (LineSearchEngine today)
│   └── EventStore.ts         append-only YAML events under Stash/
└── tools/                    one file per MCP tool, deps injected
```

Design rules the code follows:

- **Stateless.** Every tool call reads the filesystem fresh. No cache, no daemon state.
- **Canonical knowledge is read-only.** The provider only ever opens files for reading; the only write path in the whole codebase is `EventStore.append`, which targets the Stash and uses `wx` (fail-if-exists).
- **Repositories are never touched.** The server only knows about `Memory/`.

## Extending

- **New repository** → add one entry to the map in `resolver/ProjectResolver.ts` and create `Knowledge/<Name>/`.
- **New knowledge provider** (Personal/, Research/, Snippets/, …) → implement `KnowledgeProvider`, register it in `server.ts`. `list_notes` and `search_memory` already fan out across all registered providers.
- **Different search** → implement `SearchEngine`, swap it in `server.ts`.
- **New tool** → add a file in `src/tools/` exporting a `RegisterTool`, add it to the list in `server.ts`.

## Note on the Stash location

The original design doc places the Stash at `Memory/Stash/`, but on disk it lives at `Memory/Knowledge/Stash/`. The server follows the disk. If you move it, set `STASH_ROOT` — no code change needed.
