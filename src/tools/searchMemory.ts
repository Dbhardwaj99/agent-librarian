import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";
import { searchMemory } from "../core.js";

const MAX_RESULTS = 24;

export const registerSearchMemory: RegisterTool = (server, deps) => {
  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description:
        "Search every Markdown knowledge document of the project. Returns ranked section hits with filename, heading, strongest snippet, and nearby context.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        query: z.string().describe("Case-insensitive text to search for"),
        taskId: z.string().min(1).optional().describe("Optional task/run ID shared across related memory calls"),
      },
    },
    async ({ repositoryPath, query, taskId }) =>
      logged(deps.logger, "search_memory", { repositoryPath, query, taskId }, async () => {
        const { project, noteCount, results } = await searchMemory(deps, repositoryPath, query);
        // total:0 is the high-signal case (an agent expected a memory that was never
        // written); logExtra records it either way. Query `gain` surfaces these.
        return {
          result: json({
            project,
            query,
            noteCount,
            total: results.length,
            results: results.slice(0, MAX_RESULTS),
          }),
          logExtra: {
            total: results.length,
            noteCount,
            returned: Math.min(results.length, MAX_RESULTS),
            returnedFiles: new Set(results.slice(0, MAX_RESULTS).map((r) => r.file)).size,
          },
        };
      }),
  );
};
