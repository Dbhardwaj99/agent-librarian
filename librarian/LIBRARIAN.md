# LIBRARIAN

Read this whole file before changing the wiki. This is compiled knowledge, not copied code.

## Audit first

Read changed code, callers, types, and the owning note. Never guess. If code cannot prove a claim, write: “This could not be determined from the audited code.” Preserve human notes unless code proves them wrong.

## Shape

Use `repository → domain → topic → leaf`.

- A hub may own at most eight children.
- Add a topic layer only when a domain would exceed eight children; reuse an overview.
- No empty hubs, redirects, or manifests.
- Hubs state ownership, flow, modification rules, and why each child matters.
- Leaves link up. All links resolve.

## Grug writing

Use short sentences, concrete names, and bullets. One concept per note. No filler, history, copied code, duplicate facts, or giant link rows.

Target 100–250 words; hard limit 300. Shorter notes need an independent rule, contract, gap, or gotcha. Merge tiny fragments into their owner.

## Update rules

Search before creating. Prefer editing or merging. Keep paths stable when practical. Describe ownership, users, dependencies, flow, and safe modification. Cite source paths, not line numbers.

## Merge and links

- Contradiction: verify, then correct the note. New detail: extend its owner.
- Overlap: merge, update backlinks, then delete the old note.
- Human content stays unless audited code proves it wrong. If intent is uncertain, keep it and add context.
- Leaves link within their topic and up. Only hubs link across clusters. Every link resolves.

After writing, run the structure check and `git diff --check`; confirm source paths. Remove processed Stash files only after integration and passing checks.

---

Related: [[README]]
