#!/usr/bin/env node
// Read-only audit of the live and rotated tool-call logs. Run with `npm run gain`.
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig } from "./config.js";

interface Entry {
  timestamp: string;
  tool: string;
  params: {
    repositoryPath?: string;
    query?: string;
    total?: number;
    returned?: number;
    returnedFiles?: number;
    noteCount?: number;
    ok?: boolean;
    error?: string;
    durationMs?: number;
    summary?: string;
    type?: string;
    taskId?: string;
    unfiled?: boolean;
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const tally = (xs: string[]) =>
  [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1],
  );
const rows = (pairs: [string, number][], n = 10) =>
  pairs.slice(0, n).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join("\n");
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return undefined;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
};

const file = loadConfig().logFile;
const dir = path.dirname(file);
const base = path.basename(file);
const files = (await fs.readdir(dir).catch(() => []))
  .filter((name) => name === base || name.startsWith(`${base}.`))
  .map((name) => path.join(dir, name));
const raw = (await Promise.all(files.map((name) => fs.readFile(name, "utf8")))).join("");
let malformed = 0;
const entries: Entry[] = raw
  .split("\n")
  .filter(Boolean)
  .flatMap((l) => {
    try {
      return [JSON.parse(l) as Entry];
    } catch {
      malformed++;
      return [];
    }
  })
  .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

if (!entries.length) {
  console.log(`No log entries in ${file}`);
  process.exit(0);
}

const searches = entries.filter((e) => e.tool === "search_memory");
const measuredSearches = searches.filter((e) => e.params.total !== undefined);
const deliveredSearches = measuredSearches.filter((e) => e.params.returned !== undefined);
const zero = measuredSearches.filter((e) => e.params.total === 0);
const capped = deliveredSearches.filter((e) => e.params.total! > e.params.returned!);
const diversity = deliveredSearches
  .filter((e) => e.params.returned! > 0 && e.params.returnedFiles !== undefined)
  .map((e) => e.params.returnedFiles! / e.params.returned!);
const remembers = entries.filter((e) => e.tool === "remember" && e.params.summary);
const allRemembers = entries.filter((e) => e.tool === "remember");
const unfiled = allRemembers.filter((e) => e.params.unfiled === true);
const outcomeEntries = entries.filter((e) => e.params.ok !== undefined);
const failures = entries.filter((e) => e.params.ok === false);
const successes = entries.filter((e) => e.params.ok === true);
const taskEntries = entries.filter((e) => e.params.taskId);
const latency = [...new Set(entries.map((e) => e.tool))]
  .map((tool) => [
    tool,
    entries.filter((e) => e.tool === tool && e.params.durationMs !== undefined).map((e) => e.params.durationMs!),
  ] as const)
  .filter(([, xs]) => xs.length);
const latestCorpus = new Map<string, number>();
for (const entry of entries) {
  if (entry.tool === "search_memory" && entry.params.noteCount !== undefined) {
    latestCorpus.set(entry.params.repositoryPath ?? "?", entry.params.noteCount);
  }
}
// ponytail: exact normalized-summary match only. Catches copy-paste re-remembers,
// misses reworded near-dups — add token-overlap scoring if those show up in practice.
const separator = "\u0000";
const dups = tally(remembers.map((e) => `${e.params.repositoryPath}${separator}${norm(e.params.summary!)}`))
  .filter(([, n]) => n > 1)
  .map(([k, n]): [string, number] => [k.split(separator)[1], n]);

console.log(`# memory-mcp gain — ${files.length} log file(s) at ${file}`);
console.log(`${entries.length} calls  ${entries[0].timestamp} → ${entries.at(-1)!.timestamp}\n`);
console.log(
  `Coverage: outcome ${outcomeEntries.length}/${entries.length}, search results ${measuredSearches.length}/${searches.length}, remember summaries ${remembers.length}/${entries.filter((e) => e.tool === "remember").length}, malformed ${malformed}\n`,
);
console.log(
  `Success rate: ${successes.length}/${outcomeEntries.length} measured (${outcomeEntries.length ? Math.round(successes.length * 100 / outcomeEntries.length) : 0}%) · unfiled remembers ${unfiled.length}/${allRemembers.length} · task IDs ${taskEntries.length}/${entries.length}\n`,
);
console.log(`Top tools:\n${rows(tally(entries.map((e) => e.tool)))}\n`);
console.log(`By repo:\n${rows(tally(entries.map((e) => e.params.repositoryPath ?? "?")))}\n`);
console.log("Latency in ms (handler only):");
console.log(
  latency.length
    ? latency.map(([tool, xs]) => `  ${tool.padEnd(16)} p50 ${String(percentile(xs, 0.5)).padStart(4)}  p95 ${String(percentile(xs, 0.95)).padStart(4)}  n ${xs.length}`).join("\n")
    : "  (not yet logged)",
);
console.log(
  `\nSearch saturation: ${capped.length}/${deliveredSearches.length} capped · median matches ${percentile(measuredSearches.map((e) => e.params.total!), 0.5) ?? "?"} · median returned-file diversity ${diversity.length ? Math.round(percentile(diversity, 0.5)! * 100) : "?"}%`,
);
console.log("Latest corpus sizes:");
console.log(latestCorpus.size ? rows([...latestCorpus.entries()]) : "  (not yet logged)");
console.log(`Failed calls (${failures.length}):`);
console.log(failures.length ? rows(tally(failures.map((e) => `${e.tool}: ${e.params.error ?? "?"}`))) : "  (none)");
console.log(
  `\nZero-result searches (${zero.length}/${measuredSearches.length} measured — missing memory or vocabulary mismatch):`,
);
console.log(zero.length ? rows(tally(zero.map((e) => e.params.query ?? "?"))) : "  (none)");
console.log(`\nDuplicate remember() summaries (${remembers.length} measured; possible supersession debt):`);
console.log(dups.length ? rows(dups) : "  (none)");
console.log(`\nRemember event types (${remembers.length} measured):`);
console.log(remembers.length ? rows(tally(remembers.map((e) => e.params.type ?? "?"))) : "  (none)");
