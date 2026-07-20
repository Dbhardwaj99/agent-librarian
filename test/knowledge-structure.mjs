import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = new URL("../../Knowledge/", import.meta.url);
const files = [];

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if ([".obsidian", "Stash"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name.endsWith(".md")) files.push(target);
  }
}

await walk(root.pathname);

const byName = new Map();
for (const file of files) {
  const name = path.basename(file, ".md");
  byName.set(name, [...(byName.get(name) ?? []), file]);
}

const failures = [];
for (const file of files) {
  const relative = path.relative(root.pathname, file);
  const parts = relative.split(path.sep);
  assert.ok(path.basename(file) !== "manifest.md" && !parts.includes("manifest"), `${relative}: manifest note`);

  const content = await fs.readFile(file, "utf8");
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (words > 300) failures.push(`${relative}: ${words} words`);

  for (const line of content.split("\n")) {
    if (/^\s*(?:[-*]\s*)?(?:\[\[[^\]]+\]\]\s*(?:[·|,;]\s*)?)+$/.test(line)) {
      failures.push(`${relative}: navigation-only line`);
    }
  }

  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = match[1].split("|")[0].split("#")[0].trim().replace(/\.md$/, "");
    if (!target) continue;
    const project = parts[0];
    const candidates = [
      path.join(root.pathname, `${target}.md`),
      path.join(path.dirname(file), `${target}.md`),
      path.join(root.pathname, project, `${target}.md`),
    ];
    if (!(await Promise.all(candidates.map(async (candidate) => fs.access(candidate).then(() => true).catch(() => false)))).some(Boolean)
        && !(byName.get(path.basename(target))?.length)) {
      failures.push(`${relative}: unresolved ${match[0]}`);
    }
  }

  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (!/^## (Domains|Topics|Details|Features|Child pages|Child Pages)$/.test(lines[index])) continue;
    let children = 0;
    for (let child = index + 1; child < lines.length; child++) {
      if (/^## |^---$/.test(lines[child])) break;
      if (/^\s*- /.test(lines[child])) children += (lines[child].match(/\[\[/g) ?? []).length;
      else if (lines[child].trim() && children > 0) break;
    }
    if (children > 8) failures.push(`${relative}: ${children} children under ${lines[index]}`);
  }
}

assert.deepEqual(failures, []);
console.log(`knowledge structure: ${files.length} notes passed`);
