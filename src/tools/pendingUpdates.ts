import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";

export const registerPendingUpdates: RegisterTool = (server, { resolver, events, logger }) => {
  server.registerTool(
    "pending_updates",
    {
      title: "Pending updates",
      description:
        "List every pending (not yet processed) update event for the project, oldest first.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        taskId: z.string().min(1).optional().describe("Optional task/run ID shared across related memory calls"),
      },
    },
    async ({ repositoryPath, taskId }) =>
      logged(logger, "pending_updates", { repositoryPath, taskId }, async () => {
        const project = resolver.resolve(repositoryPath);
        const pending = await events.list(project);
        return {
          result: json({ project, count: pending.length, pending }),
          logExtra: { total: pending.length },
        };
      }),
  );
};
