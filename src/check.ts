import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Hard limits from LIBRARIAN.md. */
const MAX_WORDS = 300;
const MAX_CHILDREN = 8;
const NAV_ONLY_LINE = /^\s*(?:[-*]\s*)?(?:\[\[[^\]]+\]\]\s*(?:[·|,;]\s*)?)+$/;
const CHILD_SECTION = /^## (Domains|Topics|Details|Features|Child pages|Child Pages)$/;

async function markdownFiles(directory: string, out: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "Stash") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await markdownFiles(target, out);
    else if (entry.name.endsWith(".md")) out.push(target);
  }
  return out;
}

const exists = (file: string) => fs.access(file).then(() => true, () => false);

/**
 * Structure check for canonical knowledge: note length, navigation-only rows,
 * unresolved [[links]], hub fan-out, and manifest notes. Returns every failure
 * instead of stopping at the first so one run shows the whole picture.
 */
export async function checkKnowledge(knowledgeRoot: string): Promise<{ notes: number; failures: string[] }> {
  const files = await markdownFiles(knowledgeRoot);
  const byName = new Map<string, number>();
  for (const file of files) {
    const name = path.basename(file, ".md");
    byName.set(name, (byName.get(name) ?? 0) + 1);
  }

  const failures: string[] = [];
  for (const file of files) {
    const relative = path.relative(knowledgeRoot, file);
    const parts = relative.split(path.sep);
    if (path.basename(file) === "manifest.md" || parts.includes("manifest")) failures.push(`${relative}: manifest note`);

    const content = await fs.readFile(file, "utf8");
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) failures.push(`${relative}: ${words} words`);

    const lines = content.split("\n");
    for (const line of lines) {
      if (NAV_ONLY_LINE.test(line)) failures.push(`${relative}: navigation-only line`);
    }

    for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = match[1].split("|")[0].split("#")[0].trim().replace(/\.md$/, "");
      if (!target) continue;
      const candidates = [
        path.join(knowledgeRoot, `${target}.md`),
        path.join(path.dirname(file), `${target}.md`),
        path.join(knowledgeRoot, parts[0], `${target}.md`),
      ];
      const found = (await Promise.all(candidates.map(exists))).some(Boolean) || byName.has(path.basename(target));
      if (!found) failures.push(`${relative}: unresolved ${match[0]}`);
    }

    for (let index = 0; index < lines.length; index++) {
      if (!CHILD_SECTION.test(lines[index])) continue;
      let children = 0;
      for (let child = index + 1; child < lines.length; child++) {
        if (/^## |^---$/.test(lines[child])) break;
        if (/^\s*- /.test(lines[child])) children += (lines[child].match(/\[\[/g) ?? []).length;
        else if (lines[child].trim() && children > 0) break;
      }
      if (children > MAX_CHILDREN) failures.push(`${relative}: ${children} children under ${lines[index]}`);
    }
  }
  return { notes: files.length, failures };
}
