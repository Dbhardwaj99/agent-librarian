import { z } from "zod";
import { json, logged, type RegisterTool } from "./deps.js";

// Bucket for events whose repositoryPath doesn't resolve to a known project (e.g. a
// repo not yet added to ProjectResolver, or a stray/mistaken path). Never dropping the
// event beats a silent "Unknown repository" throw — the fallback keeps the original
// repositoryPath on the event so a human can re-file it later.
const UNFILED_PROJECT = "Unfiled";

export const registerRemember: RegisterTool = (server, { resolver, registry, events, logger }) => {
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
      return logged(logger, "remember", { repositoryPath, taskId, ...logEvent }, async () => {
        let project: string;
        let unfiled = false;
        try {
          project = resolver.resolve(repositoryPath);
        } catch {
          project = UNFILED_PROJECT;
          unfiled = true;
        }
        const timestamp = new Date().toISOString();
        const storedEvent = unfiled ? { timestamp, repositoryPath, ...event } : { timestamp, ...event };
        const file = await events.append(project, storedEvent);

        // A correction is only useful if it reaches every note that repeats the
        // now-wrong fact. Nudge toward those notes instead of relying on a later
        // pass to remember to go looking for them.
        let possiblyAffected: { file: string; heading: string; snippet: string }[] | undefined;
        if (!unfiled && event.type === "knowledge_correction" && event.tags?.length) {
          const already = new Set(event.files ?? []);
          possiblyAffected = (
            await Promise.all(registry.all().map((p) => p.search(project, event.tags!.join(" "))))
          )
            .flat()
            .filter((r) => !already.has(r.file))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(({ file, heading, snippet }) => ({ file, heading, snippet }));
        }

        return {
          result: json({ project, file, recorded: true, unfiled, possiblyAffected }),
          logExtra: { project, unfiled, possiblyAffected: possiblyAffected?.length },
        };
      });
    },
  );
};
