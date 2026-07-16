import type { SearchResult } from "../types/index.js";

/**
 * Pluggable full-text search over a single note's content.
 * Swap the implementation (e.g. for fuzzy or ranked search) without
 * touching providers or tools.
 */
export interface SearchEngine {
  search(file: string, content: string, query: string): SearchResult[];
}

// Filler words that match almost every note and add no ranking signal — dropping
// them keeps a long natural-language query from ballooning into hundreds of hits
// on lines that only share "the"/"a"/"and" with it.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in",
  "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with",
]);

/**
 * Case-insensitive scan, line by line, tracking the nearest Markdown heading.
 * A line matches if it contains ANY significant query word; score = how many
 * distinct significant words it contains, so multi-word natural-language
 * queries rank by relevance instead of demanding the whole phrase appear
 * verbatim (which almost never does).
 */
// ponytail: linear scan + word-count score, no IDF — a rare word counts the same as
// a common non-stopword. Fine for a few hundred markdown files; add weighting/indexing
// if it still bites after stopword filtering.
export class LineSearchEngine implements SearchEngine {
  search(file: string, content: string, query: string): SearchResult[] {
    const allWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const words = allWords.filter((w) => !STOPWORDS.has(w));
    // A query made entirely of stopwords (e.g. "to be or not to be") still searches
    // rather than returning nothing.
    if (words.length === 0) words.push(...allWords);
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
