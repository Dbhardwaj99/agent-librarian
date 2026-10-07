# agent-librarian

Persistent, **curated** project memory for coding agents (Claude Code, Codex, Cursor, or anything with a shell).

Agents search the memory before exploring code, and record what they learn as small events. A scheduled **Librarian** agent audits each event against the real source and folds it into a tidy Markdown wiki. Memory therefore gets more accurate over time instead of piling up contradictions.

Everything lives in a private git repo you own (the **vault**). The engine in this repo holds none of your data.

```text
agents ──search/read──▶ vault/Knowledge/<Project>/*.md   (canonical, Librarian-edited)
agents ──remember────▶ vault/Knowledge/Stash/<Project>/*.yaml   (append-only events)
Librarian (scheduled) ── audits source ──▶ edits Knowledge, removes consumed events, commits, pushes
```

## Install

You need Node ≥ 20.12 and git. If you want agents wired up automatically, also install Claude Code, Codex, or Cursor.

```bash
git clone https://github.com/Dbhardwaj99/agent-librarian
cd agent-librarian && npm install && npm link    # builds and puts `agent-librarian` on PATH
# or, without cloning:  npm i -g github:Dbhardwaj99/agent-librarian
```

## Set up (once)

```bash
agent-librarian init ~/agent-memory      # create a private vault, wire every agent CLI found, schedule the Librarian
cd ~/code/my-app && agent-librarian add  # register each repo you want remembered
```

`init` does three things:

- Creates `~/agent-memory`, a git repo.
- Registers the MCP server and installs `skills/agent-librarian/SKILL.md` for each agent it finds: Claude Code, Codex, and Cursor (MCP only).
- Schedules the Librarian for weekdays at 11:30, using launchd on macOS or cron on Linux.

To back up your vault and sync it across machines, give it a **private** remote:

```bash
cd ~/agent-memory && git remote add origin git@github.com:you/agent-memory.git && git push -u origin main
```

**New machine or teammate:** clone and link the engine, then run `agent-librarian init git@github.com:you/agent-memory.git`.

**Skill only**, for agents the installer doesn't know: `npx skills add Dbhardwaj99/agent-librarian --skill agent-librarian`.

## Daily use

Nothing changes in how you work. The skill teaches agents to `search_memory` before grepping and to `remember` durable findings. The Librarian runs on schedule and writes `Knowledge/librarian/daily-brief.md`. Run `agent-librarian doctor` whenever something looks off; it also flags a stash backlog that hasn't been processed for over a week.

## Commands

| Command | What it does |
|---|---|
| `init [dir \| git-url]` | Create, clone, or adopt a vault; then `install` + `schedule` (`--no-install`, `--no-schedule`) |
| `add [repo] [--project N] [--match "prefix-*"]` | Register a repo; matches its folder name anywhere in a path, so worktrees resolve too |
| `install [--claude] [--codex] [--cursor] [--dry-run]` | Register the MCP server + skill |
| `schedule [--at "weekdays 11:30"] [--sync] [--remove]` | Timer for `librarian` (or `sync`) |
| `search` / `read` / `list` / `pending` / `remember` | Same as the MCP tools, from a shell; project comes from the current directory |
| `librarian [--agent codex\|claude] [--dry-run]` | Snapshot manual edits, run the agent headless, run `check`, commit, push |
| `sync` | Commit new stash events, `pull --rebase`, push — how teammates' events reach the Librarian |
| `check` | Knowledge structure rules: ≤300 words per note, ≤8 hub children, no unresolved `[[links]]` |
| `doctor` | Vault, agents, skill freshness, schedule, stash backlog age |
| `gain` / `dashboard` | Tool-call telemetry from `<vault>/.logs/tool-calls.jsonl` |

## MCP tools

Every tool takes `repositoryPath` (the repo being worked on) and an optional `taskId` that ties related calls together in the log.

| Tool | Purpose |
|---|---|
| `list_notes` | Every canonical note for the project |
| `read_note` | One note's full content |
| `search_memory` | Ranked section search: file, heading, strongest snippet, nearby context |
| `remember` | Append an immutable event (`type`, `summary`, optional `details`, `files`, `tags`, `confidence`, `branch`). Unknown repos go to `Stash/Unfiled` instead of being dropped. |
| `pending_updates` | Unprocessed events, oldest first |

## Vault layout

```text
agent-memory/
  agent-librarian.json        # projects → repo folder matchers + paths; librarian agent/schedule/model
  Knowledge/
    README.md
    <Project>/<Project>.md    # one hub per repo, Librarian-maintained
    Stash/<Project>/*.yaml    # pending events
    librarian/daily-brief.md
    LIBRARIAN.md              # optional: override the packaged writing rules
  .logs/                      # telemetry + scheduler logs (gitignored)
```

## Why not agents writing memory directly?

That is what [Agent Memory Repo](https://github.com/AgentMemoryRepo/agentmemoryrepo) does: simple, zero-dependency, and great for personal preferences. agent-librarian trades a little setup for three things:

- **Audited knowledge.** Every claim is checked against source before it becomes canonical.
- **Conflict-free concurrent writers.** Each event is its own file, so parallel agents and teammates never merge-conflict.
- **A wiki that stays navigable.** Hubs, size limits, and link checks keep it organized.

## Development

```bash
npm test   # build + structure check, MCP smoke test, CLI journey (throwaway HOME), telemetry
```
