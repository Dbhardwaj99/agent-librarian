import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { KnowledgeProvider } from "./KnowledgeProvider.js";
import type { SearchEngine } from "../memory/SearchEngine.js";
import type { SearchResult } from "../types/index.js";

/**
 * Read-only Markdown knowledge stored as Knowledge/<Project>/**\/*.md.
 * Never writes. Hidden folders (.obsidian, .git, ...) and the Stash are
 * skipped so canonical notes are the only thing exposed.
 */
export class MarkdownKnowledgeProvider implements KnowledgeProvider {
  readonly name = "knowledge";

  constructor(
    private readonly root: string,
    private readonly searchEngine: SearchEngine,
  ) {}

  private projectDir(project: string): string {
    return path.join(this.root, project);
  }

  async listNotes(project: string): Promise<string[]> {
    const dir = this.projectDir(project);
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
      .filter((rel) => !rel.split(path.sep).some((part) => part.startsWith(".")))
      .filter((rel) => path.basename(rel) !== "manifest.md" && !rel.split(path.sep).includes("manifest"))
      .sort();
  }

  async readNote(project: string, note: string): Promise<string> {
    const dir = this.projectDir(project);
    const file = note.endsWith(".md") ? note : `${note}.md`;
    const full = path.resolve(dir, file);
    // Trust boundary: agents pass arbitrary strings; never escape the project folder.
    if (full !== dir && !full.startsWith(dir + path.sep)) {
      throw new Error(`Note path escapes project folder: ${note}`);
    }
    return fs.readFile(full, "utf8");
  }

  async search(project: string, query: string): Promise<SearchResult[]> {
    const notes = await this.listNotes(project);
    const results: SearchResult[] = [];
    for (const note of notes) {
      const content = await this.readNote(project, note);
      results.push(...this.searchEngine.search(note, content, query));
    }
    return results;
  }
}
