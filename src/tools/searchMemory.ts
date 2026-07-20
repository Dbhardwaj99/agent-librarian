import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";

const MAX_RESULTS = 24;

export const registerSearchMemory: RegisterTool = (server, { resolver, registry, logger }) => {
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
      logged(logger, "search_memory", { repositoryPath, query, taskId }, async () => {
        const project = resolver.resolve(repositoryPath);
        const providers = registry.all();
        const [noteLists, resultLists] = await Promise.all([
          Promise.all(providers.map((p) => p.listNotes(project))),
          Promise.all(providers.map((p) => p.search(project, query))),
        ]);
        const noteCount = noteLists.flat().length;
        const results = resultLists
          .flat()
          .sort((a, b) => b.rank - a.rank || b.score - a.score); // relevance, then query coverage
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
