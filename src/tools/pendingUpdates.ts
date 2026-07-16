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
      },
    },
    async ({ repositoryPath }) =>
      logged(logger, "pending_updates", { repositoryPath }, async () => {
        const project = resolver.resolve(repositoryPath);
        const pending = await events.list(project);
        return {
          result: json({ project, count: pending.length, pending }),
          logExtra: { total: pending.length },
        };
      }),
  );
};
