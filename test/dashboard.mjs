import assert from "node:assert/strict";
import fs from "node:fs/promises";

const html = await fs.readFile(new URL("../logs/dashboard.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, "dashboard script should exist");
new Function(script); // syntax check without a browser
for (const label of ["success", "unfiled fallbacks", "p50", "p95", "searches capped", "returned-file diversity", "Daily memory activity", "Tool mix", "token savings"]) {
  assert.match(html, new RegExp(label, "i"));
}
console.log("dashboard: all checks passed");
