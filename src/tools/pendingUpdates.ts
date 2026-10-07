import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";
import { pendingUpdates } from "../core.js";

export const registerPendingUpdates: RegisterTool = (server, deps) => {
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
      logged(deps.logger, "pending_updates", { repositoryPath, taskId }, async () => {
        const result = await pendingUpdates(deps, repositoryPath);
        return {
          result: json(result),
          logExtra: { total: result.count },
        };
      }),
  );
};
