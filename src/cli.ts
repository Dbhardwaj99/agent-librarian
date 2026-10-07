#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { checkKnowledge } from "./check.js";
import {
  VAULT_CONFIG,
  findVault,
  loadConfig,
  packageRoot,
  readVaultConfig,
  userConfigFile,
  writeVaultConfig,
} from "./config.js";
import { createDeps, listNotes, pendingUpdates, readNote, remember, searchMemory } from "./core.js";
import { logged } from "./tools/deps.js";

const HELP = `agent-librarian — curated, persistent project memory for coding agents

Setup
  init [dir | git-url] [--dir d]   Create (or clone, or adopt) a vault, wire agents, schedule the Librarian
                                   --no-install  --no-schedule
  add [repo] [--project Name] [--match "prefix-*"]
                                   Register a repo (default: current directory)
  install [--claude] [--codex] [--cursor] [--dry-run]
                                   Register the MCP server + skill (default: every agent found)
  schedule [--at "weekdays 11:30"|"daily 09:00"] [--sync] [--remove] [--dry-run]
                                   Run the Librarian (or just \`sync\` with --sync) on a timer
  doctor                           Diagnose vault, agents, skill, schedule, stash backlog

Memory (same as the MCP tools; project comes from --repo or the current directory)
  search <query>   read <note>   list   pending
  remember --type T --summary S [--details D] [--files a,b] [--tags x,y] [--confidence 0.9] [--agent A]

Librarian
  librarian [--agent codex|claude] [--dry-run]   Fold pending events into knowledge, check, commit, push
  sync                                           Commit new stash events, pull --rebase, push
  check                                          Validate knowledge structure
  gain / dashboard                               Tool-call telemetry
`;

const home = os.homedir();
const serverPath = path.join(packageRoot, "dist", "server.js");
const cliPath = path.join(packageRoot, "dist", "cli.js");
const skillSource = path.join(packageRoot, "skills", "agent-librarian", "SKILL.md");
const SERVER_NAME = "agent-librarian";

const print = (line = "") => console.log(line);
const printJson = (value: unknown) => console.log(JSON.stringify(value, null, 2));
function fail(message: string): never {
  console.error(`agent-librarian: ${message}`);
  process.exit(1);
}

function run(cmd: string, args: string[], opts: { cwd?: string; inherit?: boolean; input?: string } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    input: opts.input,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
  });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() || r.error?.message || "" };
}
const git = (cwd: string, ...args: string[]) => run("git", ["-C", cwd, ...args]);
const has = (bin: string) => run("which", [bin]).ok;
const expand = (p: string) => path.resolve(p.replace(/^~(?=$|\/)/, home));
const sha = (file: string) => (fs.existsSync(file) ? createHash("sha256").update(fs.readFileSync(file)).digest("hex") : "");
const today = () => new Date().toISOString().slice(0, 10);
const hasRemote = (vault: string) => git(vault, "remote").out.length > 0;

/** Stage everything under the given vault paths and commit if anything changed. Returns the new hash. */
function commit(vault: string, message: string, ...paths: string[]): string | undefined {
  git(vault, "add", "-A", "--", ...paths);
  if (git(vault, "diff", "--cached", "--quiet").ok) return undefined;
  const r = git(vault, "commit", "-q", "-m", message);
  if (!r.ok) throw new Error(`git commit failed: ${r.err}`);
  return git(vault, "rev-parse", "--short", "HEAD").out;
}

/** Commit for setup commands: a missing git identity shouldn't abort setup, just leave a note. */
function tryCommit(vault: string, message: string, ...paths: string[]): void {
  try {
    commit(vault, message, ...paths);
  } catch (err) {
    print(`! ${(err as Error).message.split("\n")[0]} — commit the vault manually.`);
  }
}

function pullAndPush(vault: string): void {
  if (!hasRemote(vault)) return;
  const pull = git(vault, "pull", "-q", "--rebase", "--autostash");
  if (!pull.ok) fail(`git pull failed: ${pull.err}`);
  const push = git(vault, "push", "-q");
  if (!push.ok) fail(`git push failed: ${push.err}`);
}

function stashEvents(stashRoot: string): { file: string; mtime: number }[] {
  if (!fs.existsSync(stashRoot)) return [];
  return fs
    .readdirSync(stashRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs
        .readdirSync(path.join(stashRoot, d.name))
        .filter((f) => f.endsWith(".yaml"))
        .map((f) => {
          const file = path.join(stashRoot, d.name, f);
          return { file, mtime: fs.statSync(file).mtimeMs };
        }),
    );
}

// ---------------------------------------------------------------- setup

function init(target: string | undefined, flags: Flags): void {
  const isUrl = !!target && (/^[\w.+-]+:\/\//.test(target) || /^[\w.-]+@[\w.-]+:/.test(target));
  let vault: string;
  if (isUrl) {
    vault = expand(flags.dir ?? "~/agent-memory");
    if (fs.existsSync(vault) && fs.readdirSync(vault).length) fail(`${vault} already exists and is not empty`);
    if (!run("git", ["clone", target!, vault], { inherit: true }).ok) fail("git clone failed");
    print(`Cloned vault into ${vault}`);
  } else {
    vault = expand(target ?? flags.dir ?? "~/agent-memory");
    if (fs.existsSync(path.join(vault, "Knowledge"))) {
      if (!fs.existsSync(path.join(vault, VAULT_CONFIG))) writeVaultConfig(vault, readVaultConfig(vault));
      print(`Using existing vault ${vault}`);
    } else {
      if (fs.existsSync(vault) && fs.readdirSync(vault).length) {
        fail(`${vault} is not empty and has no Knowledge/ folder`);
      }
      fs.cpSync(path.join(packageRoot, "templates", "vault"), vault, { recursive: true });
      // npm never ships a file named .gitignore, so the template stores it without the dot.
      fs.renameSync(path.join(vault, "gitignore"), path.join(vault, ".gitignore"));
      git(vault, "init", "-q", "-b", "main");
      tryCommit(vault, "Create agent-librarian vault", ".");
      print(`Created vault ${vault}`);
    }
  }
  fs.mkdirSync(path.dirname(userConfigFile()), { recursive: true });
  fs.writeFileSync(userConfigFile(), JSON.stringify({ vault }, null, 2) + "\n");

  if (!flags["no-install"]) install(flags);
  if (!flags["no-schedule"]) schedule(flags);
  print();
  print("Next: in each repo you want remembered, run `agent-librarian add`.");
  if (!isUrl && !hasRemote(vault)) {
    print(`Back up the vault: cd ${JSON.stringify(vault)} && git remote add origin <private repo> && git push -u origin main`);
  }
}

const RESERVED = new Set(["Stash", "Unfiled", "librarian"]);

function add(repoArg: string | undefined, flags: Flags): void {
  const vault = findVault();
  const repo = expand(repoArg ?? ".");
  if (!fs.existsSync(repo)) fail(`${repo} does not exist`);
  const top = git(repo, "rev-parse", "--show-toplevel");
  const root = top.ok ? top.out : repo;
  const folder = path.basename(root);
  const project = flags.project ?? folder;
  if (!/^[\w][\w .-]*$/.test(project) || RESERVED.has(project)) fail(`invalid project name "${project}"`);

  const config = readVaultConfig(vault);
  const entry = config.projects[project] ?? { match: [] };
  for (const pattern of [folder, ...(flags.match ? [flags.match] : [])]) {
    if (!entry.match.includes(pattern)) entry.match.push(pattern);
  }
  entry.paths = [...new Set([...(entry.paths ?? []), root])];
  config.projects[project] = entry;
  writeVaultConfig(vault, config);

  const hub = path.join(vault, "Knowledge", project, `${project}.md`);
  if (!fs.existsSync(path.dirname(hub))) {
    fs.mkdirSync(path.dirname(hub), { recursive: true });
    fs.writeFileSync(
      hub,
      `# ${project}\n\nKnowledge hub for \`${folder}\`. The Librarian fills it in from agent events.\n\n## Domains\n\n---\n`,
    );
  }
  // Committed so `sync` carries the mapping to teammates and other machines.
  tryCommit(vault, `Register ${project}`, VAULT_CONFIG, path.relative(vault, path.dirname(hub)));
  print(`Registered ${root} → ${project} (matches: ${entry.match.join(", ")})`);
}

function copySkill(dir: string, dryRun: boolean): void {
  const dest = path.join(dir, "SKILL.md");
  if (dryRun) return print(`  would copy skill → ${dest}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(skillSource, dest);
  print(`  ✓ skill → ${dest}`);
}

const codexConfig = () => path.join(home, ".codex", "config.toml");
const codexBlock = () =>
  `[mcp_servers.${SERVER_NAME}]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(serverPath)}]\nenabled = true`;
const CODEX_BLOCK_RE = new RegExp(`\\[mcp_servers\\.${SERVER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`);
const cursorConfig = () => path.join(home, ".cursor", "mcp.json");

function detectAgents(flags: Flags): ("claude" | "codex" | "cursor")[] {
  const asked = (["claude", "codex", "cursor"] as const).filter((a) => flags[a]);
  if (asked.length) return [...asked];
  return [
    ...(has("claude") ? (["claude"] as const) : []),
    ...(has("codex") ? (["codex"] as const) : []),
    ...(fs.existsSync(path.join(home, ".cursor")) ? (["cursor"] as const) : []),
  ];
}

function install(flags: Flags): void {
  const dryRun = !!flags["dry-run"];
  const agents = detectAgents(flags);
  if (!agents.length) {
    print("No Claude Code, Codex, or Cursor install found. Agents can still use the shell commands in skills/agent-librarian/SKILL.md.");
    return;
  }
  for (const agent of agents) {
    print(`${agent}:`);
    if (agent === "claude") {
      const args = ["mcp", "add", "-s", "user", SERVER_NAME, "--", process.execPath, serverPath];
      if (dryRun) print(`  would run: claude ${args.join(" ")}`);
      else {
        run("claude", ["mcp", "remove", "-s", "user", SERVER_NAME]); // re-add so a moved install updates its path
        const r = run("claude", args);
        print(r.ok ? "  ✓ MCP server registered" : `  ✗ claude mcp add failed: ${r.err}`);
      }
      copySkill(path.join(home, ".claude", "skills", SERVER_NAME), dryRun);
    } else if (agent === "codex") {
      const file = codexConfig();
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      const next = CODEX_BLOCK_RE.test(current)
        ? current.replace(CODEX_BLOCK_RE, codexBlock())
        : `${current.replace(/\n*$/, current ? "\n\n" : "")}${codexBlock()}\n`;
      if (dryRun) print(`  would write [mcp_servers.${SERVER_NAME}] to ${file}`);
      else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, next);
        print(`  ✓ MCP server → ${file}`);
      }
      copySkill(path.join(home, ".codex", "skills", SERVER_NAME), dryRun);
    } else {
      const file = cursorConfig();
      const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
      current.mcpServers = { ...current.mcpServers, [SERVER_NAME]: { command: process.execPath, args: [serverPath] } };
      if (dryRun) print(`  would write mcpServers.${SERVER_NAME} to ${file}`);
      else {
        fs.writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
        print(`  ✓ MCP server → ${file}`);
      }
    }
  }
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function schedule(flags: Flags): void {
  const vault = findVault();
  const config = readVaultConfig(vault);
  const at = flags.at ?? config.librarian.schedule;
  const m = /^(weekdays|daily)\s+(\d{1,2}):(\d{2})$/.exec(at);
  if (!m) fail(`--at must look like "weekdays 11:30" or "daily 09:00", got "${at}"`);
  const [, days, hour, minute] = m;
  const job = flags.sync ? "sync" : "librarian";
  const log = path.join(vault, ".logs", `${job}.log`);
  const dryRun = !!flags["dry-run"];

  if (process.platform === "darwin") {
    const label = `com.agent-librarian.${job}`;
    const plist = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
    const domain = `gui/${os.userInfo().uid}`;
    if (flags.remove) {
      if (!dryRun) {
        run("launchctl", ["bootout", `${domain}/${label}`]);
        fs.rmSync(plist, { force: true });
      }
      return print(`Removed ${label}`);
    }
    const intervals = (days === "weekdays" ? [1, 2, 3, 4, 5] : [undefined])
      .map(
        (d) =>
          `<dict>${d === undefined ? "" : `<key>Weekday</key><integer>${d}</integer>`}<key>Hour</key><integer>${Number(hour)}</integer><key>Minute</key><integer>${Number(minute)}</integer></dict>`,
      )
      .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(cliPath)}</string><string>${job}</string></array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH ?? "")}</string><key>HOME</key><string>${xml(home)}</string></dict>
<key>StartCalendarInterval</key><array>${intervals}</array>
<key>StandardOutPath</key><string>${xml(log)}</string>
<key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>
`;
    if (dryRun) return print(body);
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(plist, body);
    run("launchctl", ["bootout", `${domain}/${label}`]);
    const r = run("launchctl", ["bootstrap", domain, plist]);
    print(r.ok ? `✓ ${job} scheduled ${at} (${plist})` : `✗ launchctl bootstrap failed: ${r.err}`);
  } else {
    const marker = `# agent-librarian-${job}`;
    const line = `${Number(minute)} ${Number(hour)} * * ${days === "weekdays" ? "1-5" : "*"} PATH=${sh(process.env.PATH ?? "")} ${sh(process.execPath)} ${sh(cliPath)} ${job} >> ${sh(log)} 2>&1 ${marker}`;
    const current = run("crontab", ["-l"]).out.split("\n").filter((l) => l && !l.includes(marker));
    const next = [...current, ...(flags.remove ? [] : [line])].join("\n") + "\n";
    if (dryRun) return print(line);
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const r = run("crontab", ["-"], { input: next });
    print(r.ok ? (flags.remove ? `Removed ${job} cron job` : `✓ ${job} scheduled ${at} (crontab)`) : `✗ crontab failed: ${r.err}`);
  }
  if (flags.at && !flags.sync && !flags.remove) {
    writeVaultConfig(vault, { ...config, librarian: { ...config.librarian, schedule: at } });
  }
}

// ---------------------------------------------------------------- memory

async function memoryCommand(command: string, positionals: string[], flags: Flags): Promise<void> {
  const config = loadConfig();
  const deps = createDeps(config);
  const repositoryPath = expand(flags.repo ?? process.cwd());
  const base = { repositoryPath, via: "cli" };
  switch (command) {
    case "list": {
      const result = await logged(deps.logger, "list_notes", base, async () => {
        const r = await listNotes(deps, repositoryPath);
        return { result: r, logExtra: { total: r.notes.length } };
      });
      return printJson(result);
    }
    case "read": {
      const note = positionals[0] ?? fail("usage: agent-librarian read <note>");
      const { content } = await logged(deps.logger, "read_note", { ...base, note }, async () => {
        const r = await readNote(deps, repositoryPath, note);
        return { result: r, logExtra: { characters: r.content.length } };
      });
      return print(content);
    }
    case "search": {
      const query = positionals.join(" ") || fail("usage: agent-librarian search <query>");
      const result = await logged(deps.logger, "search_memory", { ...base, query }, async () => {
        const r = await searchMemory(deps, repositoryPath, query);
        const results = r.results.slice(0, 24);
        return {
          result: { ...r, total: r.results.length, results },
          logExtra: { total: r.results.length, noteCount: r.noteCount, returned: results.length },
        };
      });
      return printJson(result);
    }
    case "pending": {
      const result = await logged(deps.logger, "pending_updates", base, async () => {
        const r = await pendingUpdates(deps, repositoryPath);
        return { result: r, logExtra: { total: r.count } };
      });
      return printJson(result);
    }
    case "remember": {
      if (!flags.type || !flags.summary) fail("remember needs --type and --summary");
      const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
      const branch = flags.branch ?? (git(repositoryPath, "branch", "--show-current").out || undefined);
      const event = {
        agent: flags.agent ?? "cli",
        type: flags.type,
        summary: flags.summary,
        details: flags.details,
        files: list(flags.files),
        tags: list(flags.tags),
        confidence: flags.confidence === undefined ? undefined : Number(flags.confidence),
        branch,
      };
      const clean = Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined)) as typeof event;
      const { details: _details, ...logEvent } = clean;
      const result = await logged(deps.logger, "remember", { ...base, ...logEvent }, async () => {
        const r = await remember(deps, repositoryPath, clean);
        return { result: { ...r, recorded: true }, logExtra: { project: r.project, unfiled: r.unfiled } };
      });
      return printJson(result);
    }
  }
}

// ---------------------------------------------------------------- librarian

function sync(): void {
  const config = loadConfig();
  const stash = path.relative(config.vault, config.stashRoot);
  const hash = commit(config.vault, "Sync stash events", stash, VAULT_CONFIG);
  pullAndPush(config.vault);
  print(hash ? `✓ committed ${hash} and synced` : "✓ synced (no new events)");
}

async function librarian(flags: Flags): Promise<void> {
  const config = loadConfig();
  const { vault } = config;
  const settings = readVaultConfig(vault);
  const agent = flags.agent ?? settings.librarian.agent;
  if (agent !== "codex" && agent !== "claude") fail(`--agent must be codex or claude, got "${agent}"`);
  const dryRun = !!flags["dry-run"];
  const knowledge = path.relative(vault, config.knowledgeRoot);

  if (!dryRun) {
    // Uncommitted manual edits once blocked every run for three weeks; snapshot them instead.
    commit(vault, "Snapshot before librarian run", knowledge, VAULT_CONFIG);
    pullAndPush(vault);
  }
  const events = stashEvents(config.stashRoot);
  if (!events.length) return print("Stash is empty; nothing to do.");

  const vaultRules = path.join(config.knowledgeRoot, "LIBRARIAN.md");
  const rules = fs.existsSync(vaultRules) ? vaultRules : path.join(packageRoot, "librarian", "LIBRARIAN.md");
  const projects =
    Object.entries(settings.projects)
      .map(([name, p]) => `- ${name}: ${p.paths?.length ? p.paths.join(", ") : `(no path registered; repo folders ${p.match.join(", ")})`}`)
      .join("\n") || "- (none registered)";
  const prompt = fs
    .readFileSync(path.join(packageRoot, "librarian", "prompt.md"), "utf8")
    .replaceAll("{{vault}}", vault)
    .replaceAll("{{knowledge}}", config.knowledgeRoot)
    .replaceAll("{{stash}}", config.stashRoot)
    .replaceAll("{{rules}}", rules)
    .replaceAll("{{projects}}", projects)
    .replaceAll("{{date}}", today());

  const { model, args: extraArgs = [] } = settings.librarian;
  const sourceDirs = Object.values(settings.projects).flatMap((p) => p.paths ?? []);
  const [cmd, args] =
    agent === "codex"
      ? ["codex", ["exec", "-C", vault, "-s", "workspace-write", ...(model ? ["-m", model] : []), ...extraArgs, prompt]]
      : [
          "claude",
          [
            "-p",
            prompt,
            "--permission-mode",
            "acceptEdits",
            "--allowedTools",
            "Read Grep Glob Edit Write MultiEdit Bash(git:*)",
            ...sourceDirs.flatMap((d) => ["--add-dir", d]),
            ...(model ? ["--model", model] : []),
            ...extraArgs,
          ],
        ];
  if (dryRun) {
    print(`# ${events.length} pending events; would run in ${vault}:`);
    print(`# ${cmd} ${(args as string[]).map((a) => (a === prompt ? "<prompt>" : JSON.stringify(a))).join(" ")}`);
    print();
    return print(prompt);
  }

  print(`Librarian (${agent}) processing ${events.length} events…`);
  const r = spawnSync(cmd, args as string[], { cwd: vault, stdio: "inherit" });
  if (r.status !== 0) fail(`${agent} exited with status ${r.status ?? r.error?.message}; vault left as-is for review`);

  const { notes, failures } = await checkKnowledge(config.knowledgeRoot);
  if (failures.length) {
    const brief = path.join(config.knowledgeRoot, "librarian", "daily-brief.md");
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.appendFileSync(brief, `\n## Structure Check Failed\n\nNot committed. Fix and rerun:\n\n${failures.map((f) => `- ${f}`).join("\n")}\n`);
    fail(`structure check failed (${failures.length}); changes left uncommitted. See ${brief}`);
  }
  const hash = commit(vault, `Update knowledge base from stash ${today()}`, knowledge);
  pullAndPush(vault);
  print(hash ? `✓ ${notes} notes valid; committed ${hash}${hasRemote(vault) ? " and pushed" : ""}` : "✓ no knowledge changes");
}

async function check(): Promise<void> {
  const config = loadConfig();
  const { notes, failures } = await checkKnowledge(config.knowledgeRoot);
  failures.forEach((f) => print(`✗ ${f}`));
  print(`${failures.length ? "✗" : "✓"} ${notes} notes, ${failures.length} problems`);
  if (failures.length) process.exit(1);
}

// ---------------------------------------------------------------- doctor

async function doctor(): Promise<void> {
  const rows: [boolean | "warn", string][] = [];
  let vault: string;
  try {
    vault = findVault();
  } catch (err) {
    return fail((err as Error).message);
  }
  const config = loadConfig();
  rows.push([fs.existsSync(config.knowledgeRoot), `vault ${vault}`]);
  rows.push([git(vault, "rev-parse").ok, "vault is a git repo"]);
  rows.push([hasRemote(vault) || "warn", hasRemote(vault) ? "vault has a remote" : "vault has no remote (not backed up)"]);

  const settings = readVaultConfig(vault);
  const projects = Object.entries(settings.projects);
  rows.push([projects.length > 0 || "warn", `${projects.length} projects registered`]);
  for (const [name, p] of projects) {
    for (const dir of p.paths ?? []) rows.push([fs.existsSync(dir) || "warn", `${name}: ${dir}`]);
  }

  const skillHash = sha(skillSource);
  if (has("claude")) {
    rows.push([run("claude", ["mcp", "get", SERVER_NAME]).ok, "Claude Code: MCP server registered"]);
    rows.push([sha(path.join(home, ".claude", "skills", SERVER_NAME, "SKILL.md")) === skillHash, "Claude Code: skill current"]);
    if (run("claude", ["mcp", "get", "local-memory"]).ok) rows.push(["warn", "Claude Code: legacy local-memory server still registered"]);
  }
  if (has("codex")) {
    const toml = fs.existsSync(codexConfig()) ? fs.readFileSync(codexConfig(), "utf8") : "";
    rows.push([toml.includes(`[mcp_servers.${SERVER_NAME}]`) && toml.includes(serverPath), "Codex: MCP server registered"]);
    rows.push([sha(path.join(home, ".codex", "skills", SERVER_NAME, "SKILL.md")) === skillHash, "Codex: skill current"]);
    if (toml.includes("[mcp_servers.local-memory]")) rows.push(["warn", "Codex: legacy local-memory server still configured"]);
  }

  if (process.platform === "darwin") {
    const label = `gui/${os.userInfo().uid}/com.agent-librarian.librarian`;
    rows.push([run("launchctl", ["print", label]).ok || "warn", `Librarian scheduled (${settings.librarian.schedule}, ${settings.librarian.agent})`]);
  } else {
    rows.push([run("crontab", ["-l"]).out.includes("# agent-librarian-librarian") || "warn", "Librarian scheduled (cron)"]);
  }

  const events = stashEvents(config.stashRoot);
  const oldestDays = events.length ? Math.floor((Date.now() - Math.min(...events.map((e) => e.mtime))) / 86_400_000) : 0;
  rows.push([oldestDays <= 7 || "warn", `stash: ${events.length} pending, oldest ${oldestDays} days`]);

  const { notes, failures } = await checkKnowledge(config.knowledgeRoot);
  rows.push([failures.length === 0, `knowledge: ${notes} notes, ${failures.length} structure problems`]);

  for (const [ok, label] of rows) print(`${ok === true ? "✓" : ok === "warn" ? "!" : "✗"} ${label}`);
  if (rows.some(([ok]) => ok === false)) process.exit(1);
}

// ---------------------------------------------------------------- main

const options = {
  dir: { type: "string" },
  project: { type: "string" },
  match: { type: "string" },
  repo: { type: "string" },
  agent: { type: "string" },
  at: { type: "string" },
  type: { type: "string" },
  summary: { type: "string" },
  details: { type: "string" },
  files: { type: "string" },
  tags: { type: "string" },
  confidence: { type: "string" },
  branch: { type: "string" },
  claude: { type: "boolean" },
  codex: { type: "boolean" },
  cursor: { type: "boolean" },
  sync: { type: "boolean" },
  remove: { type: "boolean" },
  "dry-run": { type: "boolean" },
  "no-install": { type: "boolean" },
  "no-schedule": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;
type Flags = { [K in keyof typeof options]?: (typeof options)[K]["type"] extends "boolean" ? boolean : string };

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({ options, allowPositionals: true });
  } catch (err) {
    fail((err as Error).message);
  }
  const { values: flags, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (flags.version) return print(JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")).version);
  if (!command || flags.help || command === "help") return print(HELP);

  switch (command) {
    case "init": return init(rest[0], flags);
    case "add": return add(rest[0], flags);
    case "install": return install(flags);
    case "schedule": return schedule(flags);
    case "doctor": return doctor();
    case "list":
    case "read":
    case "search":
    case "pending":
    case "remember": return memoryCommand(command, rest, flags);
    case "librarian": return librarian(flags);
    case "sync": return sync();
    case "check": return check();
    case "gain": {
      await import("./gain.js");
      return;
    }
    case "dashboard": {
      const { logFile } = loadConfig();
      const dest = path.join(path.dirname(logFile), "dashboard.html");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(packageRoot, "dashboard", "dashboard.html"), dest);
      return print(`Dashboard ready: cd ${JSON.stringify(path.dirname(dest))} && python3 -m http.server 8765, then open http://localhost:8765/dashboard.html`);
    }
    default:
      fail(`unknown command "${command}". Run \`agent-librarian help\`.`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
