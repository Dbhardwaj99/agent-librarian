import type { SearchResult } from "../types/index.js";

/**
 * A source of read-only project knowledge.
 *
 * Today the only provider is MarkdownKnowledgeProvider over Memory/Knowledge.
 * Future providers (Personal/, Research/, Snippets/, ...) implement this same
 * interface and register in the ProviderRegistry — no other code changes.
 */
export interface KnowledgeProvider {
  /** Unique provider name, e.g. "knowledge". */
  readonly name: string;
  /** All note paths (relative) available for a project. */
  listNotes(project: string): Promise<string[]>;
  /** Full content of one note. Must reject paths escaping the project folder. */
  readNote(project: string, note: string): Promise<string>;
  /** Search every note of a project. */
  search(project: string, query: string): Promise<SearchResult[]>;
}
