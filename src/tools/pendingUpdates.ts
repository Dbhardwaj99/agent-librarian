import { z } from "zod";
import { json, type RegisterTool } from "./deps.js";

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
    async ({ repositoryPath }) => {
      await logger.log("pending_updates", { repositoryPath });
      const project = resolver.resolve(repositoryPath);
      const pending = await events.list(project);
      return json({ project, count: pending.length, pending });
    },
  );
};
