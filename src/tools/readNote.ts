import { z } from "zod";
import { json, type RegisterTool } from "./deps.js";

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
      },
    },
    async ({ repositoryPath, note }) => {
      await logger.log("read_note", { repositoryPath, note });
      const project = resolver.resolve(repositoryPath);
      const content = await registry.get("knowledge").readNote(project, note);
      return { content: [{ type: "text" as const, text: content }] };
    },
  );
};
