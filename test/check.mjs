// Structure check: a clean fixture passes, and each rule catches its violation.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkKnowledge } from "../dist/check.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "al-check-"));
const write = async (rel, text) => {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), text);
};

await write("App/App.md", "# App\n\n## Domains\n\n- [[App/payments|Payments]] — billing.\n");
await write("App/payments.md", "# Payments\n\nStoreManager owns purchases.\n\nPart of [[App/App|App]].\n");
await write("Stash/App/ignored.md", "[[nowhere]]\n"); // the Stash is never checked
assert.deepEqual(await checkKnowledge(root), { notes: 2, failures: [] });

await write("App/long.md", "word ".repeat(301));
await write("App/nav.md", "# Nav\n\n[[App/App]] · [[App/payments]]\n");
await write("App/broken.md", "# Broken\n\nSee [[missing-note]].\n");
await write("App/manifest.md", "# Manifest\n");
await write(
  "App/hub.md",
  "# Hub\n\n## Topics\n\n" + Array.from({ length: 9 }, () => "- [[App/payments|P]] — x.").join("\n") + "\n",
);
const { failures } = await checkKnowledge(root);
for (const expected of [
  "App/long.md: 301 words",
  "App/nav.md: navigation-only line",
  "App/broken.md: unresolved [[missing-note]]",
  "App/manifest.md: manifest note",
  "App/hub.md: 9 children under ## Topics",
]) {
  assert.ok(failures.includes(expected), `missing failure: ${expected}\n${failures.join("\n")}`);
}

await fs.rm(root, { recursive: true, force: true });
console.log("check: all checks passed");
