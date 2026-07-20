/** A ranked, context-dense hit inside one Markdown section. */
export interface SearchResult {
  /** Note path relative to the project's knowledge folder. */
  file: string;
  /** Nearest Markdown heading above the match ("" if none). */
  heading: string;
  /** The strongest matching line, trimmed. */
  snippet: string;
  /** 1-based line number of the match. */
  line: number;
  /** How many distinct query words matched the strongest line. */
  score: number;
  /** Weighted ranking score used across the whole corpus. */
  rank: number;
  /** Number of matching lines in this note section. */
  matchCount: number;
  /** A small context window around the strongest matching line. */
  context: string;
}

/** An immutable proposed-update event written to the Stash. */
export interface UpdateEvent {
  timestamp: string;
  agent: string;
  type: string;
  summary: string;
  files?: string[];
  details?: string;
  confidence?: number;
  branch?: string;
  tags?: string[];
  /** Set only when repositoryPath didn't resolve to a known project (see the "Unfiled" bucket). */
  repositoryPath?: string;
}

/** A stored event plus the file it lives in. */
export interface StoredEvent {
  file: string;
  event: UpdateEvent;
}
