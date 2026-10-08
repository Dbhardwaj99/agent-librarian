import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import type { StoredEvent, UpdateEvent } from "../types/index.js";

/**
 * Append-only store of proposed-update events under Stash/<Project>/.
 * One YAML file per event, named by timestamp and UUID. Events are never modified;
 * writes use the exclusive flag so an existing file can never be clobbered.
 */
export class EventStore {
  constructor(private readonly root: string) {}

  private projectDir(project: string): string {
    return path.join(this.root, project);
  }

  /** Persist a new event. Returns the created filename. */
  async append(project: string, event: UpdateEvent): Promise<string> {
    const dir = this.projectDir(project);
    await fs.mkdir(dir, { recursive: true });
    const name = `${event.timestamp.replace(/:/g, "-").replace(/\./g, "-")}-${randomUUID()}.yaml`;
    await fs.writeFile(path.join(dir, name), YAML.stringify(event), { flag: "wx" });
    return name;
  }

  /** All pending events for a project, oldest first. */
  async list(project: string): Promise<StoredEvent[]> {
    const dir = this.projectDir(project);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const events: StoredEvent[] = [];
    for (const name of names.filter((n) => n.endsWith(".yaml")).sort()) {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      events.push({ file: name, event: YAML.parse(raw) as UpdateEvent });
    }
    return events;
  }
}
