import * as path from "node:path";
import type { ProjectConfig } from "../config.js";

type Projects = Record<string, Pick<ProjectConfig, "match">>;

const matches = (pattern: string, name: string) =>
  pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

/**
 * Maps a repository path to its knowledge project using the vault's
 * `projects` matchers. The innermost matching folder wins, so worktrees
 * nested inside a repo (repo/.claude/worktrees/x) resolve to that repo.
 */
export class ProjectResolver {
  private readonly projects: () => Projects;

  constructor(projects: Projects | (() => Projects)) {
    this.projects = typeof projects === "function" ? projects : () => projects;
  }

  /** Resolve e.g. /Users/x/code/kukufm-ios to "Kuku". Throws with the known repos on failure. */
  resolve(repositoryPath: string): string {
    const projects = Object.entries(this.projects());
    const segments = path.resolve(repositoryPath).split(path.sep).filter(Boolean).reverse();
    for (const segment of segments) {
      const hit = projects.find(([, p]) => p.match.some((pattern) => matches(pattern, segment)));
      if (hit) return hit[0];
    }
    const known = projects.flatMap(([, p]) => p.match).join(", ") || "none";
    throw new Error(
      `Unknown repository "${path.basename(repositoryPath)}". Register it with \`librarian add <repo>\`. Known repositories: ${known}`,
    );
  }
}
