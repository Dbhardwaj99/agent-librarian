import type { SearchResult } from "../types/index.js";

/**
 * Pluggable full-text search over a single note's content.
 * Swap the implementation (e.g. for fuzzy or ranked search) without
 * touching providers or tools.
 */
export interface SearchEngine {
  search(file: string, content: string, query: string, context?: SearchContext): SearchResult[];
}

export interface SearchContext {
  documentCount: number;
  documentFrequency: Map<string, number>;
}

// Filler words that match almost every note and add no ranking signal — dropping
// them keeps a long natural-language query from ballooning into hundreds of hits
// on lines that only share "the"/"a"/"and" with it.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in",
  "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with",
]);

export function tokenize(text: string): string[] {
  const raw = text.match(/[a-z0-9]+/gi) ?? [];
  const split = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").match(/[a-z0-9]+/gi) ?? [];
  return [...new Set([...raw, ...split].map((word) => word.toLowerCase()))];
}

function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function idf(term: string, context?: SearchContext): number {
  if (!context) return 1;
  const documentFrequency = context.documentFrequency.get(term) ?? 0;
  return Math.log((context.documentCount + 1) / (documentFrequency + 1)) + 1;
}

/**
 * Results are grouped by Markdown section so one note returns context-dense
 * evidence instead of flooding the cap with adjacent matching lines.
 */
export class LineSearchEngine implements SearchEngine {
  search(file: string, content: string, query: string, context?: SearchContext): SearchResult[] {
    const allWords = tokenize(query);
    const words = allWords.filter((w) => !STOPWORDS.has(w));
    // A query made entirely of stopwords (e.g. "to be or not to be") still searches
    // rather than returning nothing.
    if (words.length === 0) words.push(...allWords);
    if (words.length === 0) return [];
    const results: SearchResult[] = [];
    const lines = content.split("\n");
    const sections: { heading: string; start: number; end: number }[] = [];
    let heading = "";
    let start = 0;
    const closeSection = (end: number) => {
      if (end > start) sections.push({ heading, start, end });
    };

    for (let i = 0; i < lines.length; i++) {
      if (!/^#{1,6}\s/.test(lines[i])) continue;
      if (i > start) closeSection(i);
      heading = lines[i].replace(/^#{1,6}\s+/, "").trim();
      start = i;
    }
    closeSection(lines.length);

    const queryCompact = compact(query);
    for (const section of sections) {
      const headingTerms = new Set(tokenize(section.heading));
      const hits: { line: number; score: number; rank: number }[] = [];
      const matchedTerms = new Set<string>();

      for (let i = section.start; i < section.end; i++) {
        const line = lines[i];
        const prose = line.replace(/\[\[[^\]]+\]\]/g, "");
        if (line.includes("[[") && !/[\p{L}\p{N}]/u.test(prose)) continue;
        const lineTerms = new Set(tokenize(line));
        const matched = words.filter((word) => lineTerms.has(word));
        if (!matched.length) continue;
        matched.forEach((word) => matchedTerms.add(word));
        const base = matched.reduce((sum, word) => sum + idf(word, context), 0);
        const phraseBonus = queryCompact.length >= 8 && compact(line).includes(queryCompact) ? 2 : 0;
        const headingBonus = matched.some((word) => headingTerms.has(word)) ? 0.5 : 0;
        hits.push({ line: i, score: matched.length, rank: base + phraseBonus + headingBonus });
      }

      if (!hits.length) continue;
      hits.sort((a, b) => b.rank - a.rank || b.score - a.score || a.line - b.line);
      const best = hits[0];
      const contextStart = Math.max(section.start, best.line - 2);
      const contextEnd = Math.min(section.end, best.line + 3);
      const density = Math.min(3, hits.length - 1) * 0.35 + (matchedTerms.size / words.length) * 1.5;
      results.push({
        file,
        heading: section.heading,
        snippet: lines[best.line].trim(),
        line: best.line + 1,
        score: best.score,
        rank: best.rank + density,
        matchCount: hits.length,
        context: lines.slice(contextStart, contextEnd).join("\n").trim(),
      });
    }
    return results;
  }
}
