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
 * Case-insensitive substring scan, line by line, tracking the nearest
 * Markdown heading above each match.
 */
// ponytail: linear scan, fine for a few hundred markdown files; replace with an indexed engine if it ever feels slow.
export class LineSearchEngine implements SearchEngine {
  search(file: string, content: string, query: string): SearchResult[] {
    const needle = query.toLowerCase();
    const results: SearchResult[] = [];
    let heading = "";
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,6}\s/.test(line)) heading = line.replace(/^#{1,6}\s+/, "").trim();
      if (line.toLowerCase().includes(needle)) {
        results.push({ file, heading, snippet: line.trim(), line: i + 1 });
      }
    }
    return results;
  }
}
