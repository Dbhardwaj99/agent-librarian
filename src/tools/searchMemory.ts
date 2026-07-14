import { z } from "zod";
import { json, type RegisterTool } from "./deps.js";

const MAX_RESULTS = 50;

export const registerSearchMemory: RegisterTool = (server, { resolver, registry, logger }) => {
  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description:
        "Search every Markdown knowledge document of the project. Returns filename, nearest heading, and the matching snippet.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        query: z.string().describe("Case-insensitive text to search for"),
      },
    },
    async ({ repositoryPath, query }) => {
      await logger.log("search_memory", { repositoryPath, query });
      const project = resolver.resolve(repositoryPath);
      const results = (
        await Promise.all(registry.all().map((p) => p.search(project, query)))
      ).flat();
      return json({
        project,
        query,
        total: results.length,
        results: results.slice(0, MAX_RESULTS),
      });
    },
  );
};
