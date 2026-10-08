import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Package root: dist/config.js -> package folder. Ships skills, librarian prompt, templates. */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The vault's own settings file, committed with the knowledge. */
export const VAULT_CONFIG = "librarian.json";

export interface ProjectConfig {
  /** Folder names that identify the project's repos. A trailing `*` matches a prefix. */
  match: string[];
  /** Absolute repo paths registered with `add`, so the Librarian knows where to audit source. */
  paths?: string[];
}

export interface VaultConfig {
  projects: Record<string, ProjectConfig>;
  /** `model` and extra CLI `args` are passed to the agent, e.g. ["-c", "model_reasoning_effort=medium"]. */
  librarian: { agent: "codex" | "claude"; schedule: string; model?: string; args?: string[] };
}

/**
 * Filesystem layout. Everything hangs off the vault: a git repo holding
 * Knowledge/ (canonical notes + Stash/) and librarian.json.
 */
export interface Config {
  vault: string;
  /** Root of canonical knowledge, e.g. <vault>/Knowledge. Read-only to agents. */
  knowledgeRoot: string;
  /** Root of the event stash, e.g. <vault>/Knowledge/Stash. Append-only. */
  stashRoot: string;
  /** JSONL history of tool calls. Gitignored. */
  logFile: string;
  /** Rotate the log once it reaches this many bytes. Override with LOG_MAX_BYTES. */
  logMaxBytes: number;
}

/** Per-user pointer to the vault: ~/.config/librarian/config.json. */
export const userConfigFile = () => path.join(os.homedir(), ".config", "librarian", "config.json");

export function findVault(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MEMORY_ROOT) return path.resolve(env.MEMORY_ROOT);
  try {
    const vault = JSON.parse(fs.readFileSync(userConfigFile(), "utf8")).vault;
    if (typeof vault === "string") return vault;
  } catch {
    // fall through to the actionable error below
  }
  throw new Error("No vault configured. Run `librarian init` (or set MEMORY_ROOT).");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const vault = findVault(env);
  const knowledgeRoot = env.KNOWLEDGE_ROOT ?? path.join(vault, "Knowledge");
  // ponytail: Stash lives inside Knowledge/ on disk; move it by setting STASH_ROOT.
  const stashRoot = env.STASH_ROOT ?? path.join(knowledgeRoot, "Stash");
  const logFile = env.LOG_FILE ?? path.join(vault, ".logs", "tool-calls.jsonl");
  const logMaxBytes = Number(env.LOG_MAX_BYTES) || 5_000_000;
  return { vault, knowledgeRoot, stashRoot, logFile, logMaxBytes };
}

const DEFAULT_VAULT_CONFIG: VaultConfig = {
  projects: {},
  librarian: { agent: "codex", schedule: "weekdays 11:30" },
};

/** Read <vault>/librarian.json. Re-read on every call so `add` takes effect without a restart. */
export function readVaultConfig(vault: string): VaultConfig {
  let raw: Partial<VaultConfig> = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(vault, VAULT_CONFIG), "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return {
    projects: raw.projects ?? {},
    librarian: { ...DEFAULT_VAULT_CONFIG.librarian, ...raw.librarian },
  };
}

export function writeVaultConfig(vault: string, config: VaultConfig): void {
  fs.writeFileSync(path.join(vault, VAULT_CONFIG), JSON.stringify(config, null, 2) + "\n");
}
