import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";
import { listNotes } from "../core.js";

export const registerListNotes: RegisterTool = (server, deps) => {
  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "List every Markdown knowledge document available for the project at the given repository root path.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        taskId: z.string().min(1).optional().describe("Optional task/run ID shared across related memory calls"),
      },
    },
    async ({ repositoryPath, taskId }) =>
      logged(deps.logger, "list_notes", { repositoryPath, taskId }, async () => {
        const { project, notes } = await listNotes(deps, repositoryPath);
        return { result: json({ project, notes }), logExtra: { total: notes.length } };
      }),
  );
};
