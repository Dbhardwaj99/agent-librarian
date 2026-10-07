// New-user journey + team sync, in a throwaway HOME. Run with `npm test`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cli = new URL("../dist/cli.js", import.meta.url).pathname;
const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "al-cli-")));
const home = path.join(tmp, "home");
const bin = path.join(tmp, "bin");
await fs.mkdir(home);
await fs.mkdir(bin);
// Only node and git on PATH: no claude/codex, so nothing can touch a real agent setup.
const gitPath = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
await fs.symlink(process.execPath, path.join(bin, "node"));
await fs.symlink(gitPath, path.join(bin, "git"));
const env = {
  HOME: home,
  PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
  GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
};
const al = (args, { cwd = tmp, extraEnv = {} } = {}) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...env, ...extraEnv }, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const ok = (args, opts) => {
  const r = al(args, opts);
  assert.equal(r.code, 0, `agent-librarian ${args.join(" ")} failed:\n${r.out}`);
  return r.out;
};
const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

// Before init: an actionable error, not a stack trace.
assert.match(al(["search", "anything"]).out, /No vault configured.*agent-librarian init/);

// init creates a committed vault and records it for the server/CLI.
const vault = path.join(tmp, "vault");
ok(["init", vault, "--no-install", "--no-schedule"]);
assert.equal(JSON.parse(await fs.readFile(path.join(home, ".config/agent-librarian/config.json"), "utf8")).vault, vault);
await fs.access(path.join(vault, ".gitignore"));
await fs.access(path.join(vault, "Knowledge/Stash/.gitkeep"));
assert.match(sh("git", ["log", "--oneline"], vault), /Create agent-librarian vault/);

// add (from inside the repo, no args) registers it, stubs a hub, and commits.
const repo = path.join(tmp, "code", "my-app");
await fs.mkdir(path.join(repo, "src"), { recursive: true });
sh("git", ["init", "-q"], repo);
ok(["add"], { cwd: repo });
const config = JSON.parse(await fs.readFile(path.join(vault, "agent-librarian.json"), "utf8"));
assert.deepEqual(config.projects["my-app"], { match: ["my-app"], paths: [repo] });
await fs.access(path.join(vault, "Knowledge/my-app/my-app.md"));
assert.match(sh("git", ["log", "--oneline", "-1"], vault), /Register my-app/);

// Memory commands work from any subfolder of the repo, without MCP.
const recorded = JSON.parse(ok(
  ["remember", "--type", "gotcha", "--summary", "Webhooks retry three times.", "--tags", "webhooks,retry", "--agent", "test"],
  { cwd: path.join(repo, "src") },
));
assert.equal(recorded.project, "my-app");
assert.equal(recorded.unfiled, false);
assert.equal(JSON.parse(ok(["pending"], { cwd: repo })).count, 1);
assert.equal(JSON.parse(ok(["search", "webhooks"], { cwd: repo })).total, 0, "events are not knowledge until the Librarian runs");
assert.deepEqual(JSON.parse(ok(["list"], { cwd: repo })).notes, ["my-app.md"]);
assert.match(ok(["read", "my-app.md"], { cwd: repo }), /Knowledge hub for `my-app`/);
assert.equal(JSON.parse(ok(["remember", "--type", "fact", "--summary", "Stray."], { cwd: tmp })).unfiled, true);
assert.match(ok(["check"]), /✓ 2 notes, 0 problems/);

// Telemetry is written inside the vault, gitignored.
assert.match(await fs.readFile(path.join(vault, ".logs/tool-calls.jsonl"), "utf8"), /"via":"cli"/);

// Dry runs describe agent wiring and scheduling without touching anything.
const install = ok(["install", "--claude", "--codex", "--dry-run"]);
assert.match(install, /would run: claude mcp add -s user agent-librarian/);
assert.match(install, /would write \[mcp_servers\.agent-librarian\]/);
await assert.rejects(fs.access(path.join(home, ".codex")), "dry run must not write agent config");
const schedule = ok(["schedule", "--dry-run"]);
assert.match(schedule, process.platform === "darwin" ? /<string>com\.agent-librarian\.librarian<\/string>/ : /# agent-librarian-librarian/);
const librarian = ok(["librarian", "--dry-run"]);
assert.match(librarian, /2 pending events/);
assert.match(librarian, new RegExp(`my-app: ${repo}`));
assert.match(librarian, /codex "exec" "-C"/);
assert.match(ok(["doctor"]).replace(/^✗.*$/gm, ""), /stash: 2 pending/);

// Team sync: two clones of one vault exchange events with no conflicts.
const remote = path.join(tmp, "remote.git");
sh("git", ["init", "-q", "--bare", remote], tmp);
sh("git", ["remote", "add", "origin", remote], vault);
sh("git", ["push", "-q", "-u", "origin", "main"], vault);
const vault2 = path.join(tmp, "vault2");
ok(["init", `file://${remote}`, "--dir", vault2, "--no-install", "--no-schedule"]);
assert.match(ok(["remember", "--type", "fact", "--summary", "From machine two."], { cwd: repo }), /"project": "my-app"/,
  "the registered mapping travels with the vault");
ok(["sync"]); // vault2 (current config) pushes its event
ok(["sync"], { extraEnv: { MEMORY_ROOT: vault } }); // vault 1 commits its events, pulls, pushes
ok(["sync"]); // vault2 pulls vault 1's events
for (const v of [vault, vault2]) {
  const events = (await fs.readdir(path.join(v, "Knowledge/Stash/my-app"))).filter((f) => f.endsWith(".yaml"));
  assert.equal(events.length, 2, `${v} should hold both my-app events`);
}

await fs.rm(tmp, { recursive: true, force: true });
console.log("cli: all checks passed");
