import { z } from "zod";
import { json, type RegisterTool } from "./deps.js";

export const registerRemember: RegisterTool = (server, { resolver, events, logger }) => {
  server.registerTool(
    "remember",
    {
      title: "Remember",
      description:
        "Record a proposed knowledge update as an immutable event. Never modifies canonical knowledge; the Librarian processes events later.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        agent: z.string().describe('Name of the recording agent, e.g. "Claude Code"'),
        type: z.string().describe('Event type, e.g. "architecture_change"'),
        summary: z.string().describe("One-paragraph summary of the change or learning"),
        details: z.string().optional().describe("Longer free-form details"),
        files: z.array(z.string()).optional().describe("Repository files involved"),
        confidence: z.number().min(0).max(1).optional().describe("Confidence 0..1"),
        branch: z.string().optional().describe("Current git branch name"),
        tags: z.array(z.string()).optional().describe("Topic tags"),
      },
    },
    async ({ repositoryPath, ...event }) => {
      await logger.log("remember", { repositoryPath, ...event });
      const project = resolver.resolve(repositoryPath);
      const timestamp = new Date().toISOString();
      const file = await events.append(project, { timestamp, ...event });
      return json({ project, file, recorded: true });
    },
  );
};
