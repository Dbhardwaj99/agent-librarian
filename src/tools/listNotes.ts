import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";

export const registerListNotes: RegisterTool = (server, { resolver, registry, logger }) => {
  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "List every Markdown knowledge document available for the project at the given repository root path.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
      },
    },
    async ({ repositoryPath }) =>
      logged(logger, "list_notes", { repositoryPath }, async () => {
        const project = resolver.resolve(repositoryPath);
        const notes = (
          await Promise.all(registry.all().map((p) => p.listNotes(project)))
        ).flat();
        return { result: json({ project, notes }), logExtra: { total: notes.length } };
      }),
  );
};
