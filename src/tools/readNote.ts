import { z } from "zod";
import { logged, type RegisterTool } from "./deps.js";

export const registerReadNote: RegisterTool = (server, { resolver, registry, logger }) => {
  server.registerTool(
    "read_note",
    {
      title: "Read note",
      description:
        "Read one Markdown knowledge document for the project. Use a note path returned by list_notes.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        note: z.string().describe("Note path relative to the project's knowledge folder"),
        taskId: z.string().min(1).optional().describe("Optional task/run ID shared across related memory calls"),
      },
    },
    async ({ repositoryPath, note, taskId }) =>
      logged(logger, "read_note", { repositoryPath, note, taskId }, async () => {
        const project = resolver.resolve(repositoryPath);
        const content = await registry.get("knowledge").readNote(project, note);
        return {
          result: { content: [{ type: "text" as const, text: content }] },
          logExtra: { characters: content.length },
        };
      }),
  );
};
