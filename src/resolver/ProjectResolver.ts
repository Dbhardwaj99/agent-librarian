import * as path from "node:path";

/**
 * Maps a repository root path to its knowledge project name.
 *
 * This is the ONLY place project-specific mapping lives. To support a new
 * repository, add one entry here (and create its Knowledge/<name> folder).
 */
const REPO_TO_PROJECT: Record<string, string> = {
  "Memory": "MCP",
  "kukufm-ios": "Kuku",
  "Quest For Duskara": "Duskara",
  "OpenFront": "OpenFront",
  "OpenFrontIO": "OpenFront",
};

export class ProjectResolver {
  constructor(private readonly mapping: Record<string, string> = REPO_TO_PROJECT) {}

  /**
   * Resolve a repository path (e.g. /Users/x/Documents/kukufm-ios) to a
   * project name (e.g. "Kuku"). Throws with the known repos on failure.
   */
  resolve(repositoryPath: string): string {
    const resolvedPath = path.resolve(repositoryPath);
    const segments = resolvedPath.split(path.sep).reverse();
    const repoName = segments.find((name) => this.mapping[name])
      ?? segments.find((name) => name.startsWith("Quest For Duskara-"))
      ?? path.basename(resolvedPath);
    const project = this.mapping[repoName]
      ?? (repoName.startsWith("Quest For Duskara-") ? this.mapping["Quest For Duskara"] : undefined);
    if (!project) {
      const known = Object.keys(this.mapping).join(", ");
      throw new Error(
        `Unknown repository "${repoName}". Known repositories: ${known}`,
      );
    }
    return project;
  }
}
