import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";
import { remember } from "../core.js";

export const registerRemember: RegisterTool = (server, deps) => {
  server.registerTool(
    "remember",
    {
      title: "Remember",
      description:
        "Record a proposed knowledge update as an immutable event. Never modifies canonical knowledge; the Librarian processes events later.",
      inputSchema: {
        repositoryPath: z.string().describe("Absolute path of the repository being worked on (use the current working directory)"),
        taskId: z.string().min(1).optional().describe("Optional task/run ID shared across related memory calls"),
        agent: z.string().describe('Name of the recording agent, e.g. "Claude Code"'),
        type: z.string().describe('Event type, e.g. "architecture_change", "failed_attempt", "gotcha", "knowledge_correction", or "abstained"'),
        summary: z.string().describe("One-paragraph summary of the change or learning"),
        details: z.string().optional().describe("Longer free-form details"),
        files: z.array(z.string()).optional().describe("Repository files involved"),
        confidence: z.number().min(0).max(1).optional().describe("Confidence 0..1"),
        branch: z.string().optional().describe("Current git branch name"),
        tags: z.array(z.string()).optional().describe("Topic tags"),
      },
    },
    async ({ repositoryPath, taskId, ...event }) => {
      const { details: _details, ...logEvent } = event;
      return logged(deps.logger, "remember", { repositoryPath, taskId, ...logEvent }, async () => {
        const { project, file, unfiled, possiblyAffected } = await remember(deps, repositoryPath, event);
        return {
          result: json({ project, file, recorded: true, unfiled, possiblyAffected }),
          logExtra: { project, unfiled, possiblyAffected: possiblyAffected?.length },
        };
      });
    },
  );
};
