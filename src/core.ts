import { readVaultConfig, type Config } from "./config.js";
import { ProjectResolver } from "./resolver/ProjectResolver.js";
import { ProviderRegistry } from "./providers/ProviderRegistry.js";
import { MarkdownKnowledgeProvider } from "./providers/MarkdownKnowledgeProvider.js";
import { LineSearchEngine } from "./memory/SearchEngine.js";
import { EventStore } from "./memory/EventStore.js";
import { CallLogger } from "./memory/CallLogger.js";
import type { SearchResult, UpdateEvent } from "./types/index.js";

/**
 * The five memory operations, shared by the MCP tools (src/tools) and the
 * CLI (src/cli.ts) so an agent without MCP gets identical behavior from a shell.
 */
export interface CoreDeps {
  resolver: ProjectResolver;
  registry: ProviderRegistry;
  events: EventStore;
}

/** Composition root shared by the MCP server and the CLI. */
export function createDeps(config: Config) {
  return {
    // Re-read the vault config per call so `librarian add` applies without a restart.
    resolver: new ProjectResolver(() => readVaultConfig(config.vault).projects),
    registry: new ProviderRegistry().register(
      new MarkdownKnowledgeProvider(config.knowledgeRoot, new LineSearchEngine()),
    ),
    events: new EventStore(config.stashRoot),
    logger: new CallLogger(config.logFile, config.logMaxBytes),
  };
}

// Bucket for events whose repositoryPath doesn't resolve to a known project (e.g. a
// repo not yet registered, or a stray/mistaken path). Never dropping the event beats
// a silent "Unknown repository" throw — the fallback keeps the original
// repositoryPath on the event so a human can re-file it later.
export const UNFILED_PROJECT = "Unfiled";

export async function listNotes({ resolver, registry }: CoreDeps, repositoryPath: string) {
  const project = resolver.resolve(repositoryPath);
  const notes = (await Promise.all(registry.all().map((p) => p.listNotes(project)))).flat();
  return { project, notes };
}

export async function readNote({ resolver, registry }: CoreDeps, repositoryPath: string, note: string) {
  const project = resolver.resolve(repositoryPath);
  const content = await registry.get("knowledge").readNote(project, note);
  return { project, content };
}

/** Every hit, best first: relevance (rank), then query-word coverage (score). */
export async function searchMemory({ resolver, registry }: CoreDeps, repositoryPath: string, query: string) {
  const project = resolver.resolve(repositoryPath);
  const providers = registry.all();
  const [noteLists, resultLists] = await Promise.all([
    Promise.all(providers.map((p) => p.listNotes(project))),
    Promise.all(providers.map((p) => p.search(project, query))),
  ]);
  const results: SearchResult[] = resultLists.flat().sort((a, b) => b.rank - a.rank || b.score - a.score);
  return { project, query, noteCount: noteLists.flat().length, results };
}

export async function remember(
  { resolver, registry, events }: CoreDeps,
  repositoryPath: string,
  event: Omit<UpdateEvent, "timestamp" | "repositoryPath">,
) {
  let project: string;
  let unfiled = false;
  try {
    project = resolver.resolve(repositoryPath);
  } catch {
    project = UNFILED_PROJECT;
    unfiled = true;
  }
  const timestamp = new Date().toISOString();
  const storedEvent = unfiled ? { timestamp, repositoryPath, ...event } : { timestamp, ...event };
  const file = await events.append(project, storedEvent);

  // A correction is only useful if it reaches every note that repeats the
  // now-wrong fact. Nudge toward those notes instead of relying on a later
  // pass to remember to go looking for them.
  let possiblyAffected: { file: string; heading: string; snippet: string }[] | undefined;
  if (!unfiled && event.type === "knowledge_correction" && event.tags?.length) {
    const already = new Set(event.files ?? []);
    possiblyAffected = (await Promise.all(registry.all().map((p) => p.search(project, event.tags!.join(" ")))))
      .flat()
      .filter((r) => !already.has(r.file))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ file, heading, snippet }) => ({ file, heading, snippet }));
  }
  return { project, file, unfiled, possiblyAffected };
}

export async function pendingUpdates({ resolver, events }: CoreDeps, repositoryPath: string) {
  const project = resolver.resolve(repositoryPath);
  const pending = await events.list(project);
  return { project, count: pending.length, pending };
}
