# Librarian

Persistent, **curated** project memory for coding agents (Claude Code, Codex, Cursor, or anything with a shell).

Agents search the memory before exploring code, and record what they learn as small events. A scheduled **Librarian** agent audits each event against the real source and folds it into a tidy Markdown wiki. Memory therefore gets more accurate over time instead of piling up contradictions.

Everything lives in a private git repo you own (the **vault**). The engine in this repo holds none of your data.

```text
agents ──search/read──▶ vault/Knowledge/<Project>/*.md   (canonical, Librarian-edited)
agents ──remember────▶ vault/Knowledge/Stash/<Project>/*.yaml   (append-only events)
Librarian (scheduled) ── audits source ──▶ edits Knowledge, removes consumed events, commits, pushes
```

Read the [four-page project report](reports/librarian-report.pdf) for three months of usage data, the savings model, and a comparison with Agent Memory Repo.

## Install

You need Node ≥ 20.12 and git. If you want agents wired up automatically, also install Claude Code, Codex, or Cursor.

```bash
git clone https://github.com/Dbhardwaj99/librarian
cd librarian && npm install && npm link    # builds and puts `librarian` on PATH
```

(`npm i -g github:…` doesn't work: npm skips the TypeScript build for global git installs. Clone instead until the package is on npm.)

## Set up (once)

```bash
librarian init ~/agent-memory      # create a private vault, wire every agent CLI found, schedule the Librarian
cd ~/code/my-app && librarian add  # register each repo you want remembered
```

`init` does three things:

- Creates `~/agent-memory`, a git repo.
- Registers the MCP server and installs `skills/librarian/SKILL.md` for each agent it finds: Claude Code, Codex, and Cursor (MCP only).
- Schedules the Librarian for weekdays at 11:30, using launchd on macOS or cron on Linux.

To back up your vault and sync it across machines, give it a **private** remote:

```bash
cd ~/agent-memory && git remote add origin git@github.com:you/agent-memory.git && git push -u origin main
```

**New machine or teammate:** clone and link the engine, then run `librarian init git@github.com:you/agent-memory.git`.

**Skill only**, for agents the installer doesn't know: `npx skills add Dbhardwaj99/librarian --skill librarian`.

## Daily use

Nothing changes in how you work. The skill teaches agents to `search_memory` before grepping and to `remember` durable findings. The Librarian runs on schedule and writes `Knowledge/librarian/daily-brief.md`. Run `librarian doctor` whenever something looks off; it also flags a stash backlog that hasn't been processed for over a week.

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
| `gain` | Tool-call telemetry from `<vault>/.logs/tool-calls.jsonl` |

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
  librarian.json        # projects → repo folder matchers + paths; librarian agent/schedule/model
  Knowledge/
    README.md
    <Project>/<Project>.md    # one hub per repo, Librarian-maintained
    Stash/<Project>/*.yaml    # pending events
    librarian/daily-brief.md
    LIBRARIAN.md              # optional: override the packaged writing rules
  .logs/                      # telemetry + scheduler logs (gitignored)
```

## Why not agents writing memory directly?

Both Librarian and [Agent Memory Repo](https://github.com/AgentMemoryRepo/agentmemoryrepo) keep linked knowledge in a Git repository. Agent Memory Repo defines direct note updates and periodic Dreaming. Librarian packages a coding workflow with three features:

- **Audited knowledge.** Every claim is checked against source before it becomes canonical.
- **Separate proposals.** Each event is its own file, so agents can record findings independently before the Librarian merges them.
- **A wiki that stays navigable.** Hubs, size limits, and link checks keep it organized.

## Renaming an existing installation

The project and command are now `librarian`. Before moving an existing checkout, run the old command with `schedule --remove`. Rename the vault settings file to `librarian.json` and the user config directory to `~/.config/librarian`. Update registered paths if the checkout moved. Remove the old MCP registration and skill, then run `npm link`, `librarian install`, and `librarian schedule` from the renamed checkout. Restart agent sessions to load the new MCP name. The knowledge vault itself does not need to move.

## Development

```bash
npm test   # build + structure check, MCP smoke test, CLI journey (throwaway HOME), telemetry
```
