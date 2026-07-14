import type { SearchResult } from "../types/index.js";

/**
 * Pluggable full-text search over a single note's content.
 * Swap the implementation (e.g. for fuzzy or ranked search) without
 * touching providers or tools.
 */
export interface SearchEngine {
  search(file: string, content: string, query: string): SearchResult[];
}

/**
 * Case-insensitive scan, line by line, tracking the nearest Markdown heading.
 * A line matches if it contains ANY query word; score = how many distinct query
 * words it contains, so multi-word natural-language queries rank by relevance
 * instead of demanding the whole phrase appear verbatim (which almost never does).
 */
// ponytail: linear scan + word-count score, no IDF — a rare word counts the same as
// a common one. Fine for a few hundred markdown files; add weighting/indexing if it bites.
export class LineSearchEngine implements SearchEngine {
  search(file: string, content: string, query: string): SearchResult[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const results: SearchResult[] = [];
    let heading = "";
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,6}\s/.test(line)) heading = line.replace(/^#{1,6}\s+/, "").trim();
      const lc = line.toLowerCase();
      const score = words.filter((w) => lc.includes(w)).length;
      if (score > 0) {
        results.push({ file, heading, snippet: line.trim(), line: i + 1, score });
      }
    }
    return results;
  }
}
