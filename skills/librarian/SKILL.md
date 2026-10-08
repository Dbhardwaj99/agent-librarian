---
name: librarian
description: Use librarian (MCP server or `librarian` CLI) for persistent project knowledge. Memory is the primary source of architectural context and durable project knowledge. Search memory before broad repository exploration to avoid rediscovering existing knowledge. Record durable insights as they are learned.
---

# Librarian

Persistent project knowledge lives in the `librarian` MCP server.

It is the ONLY persistent knowledge system for repositories.

Do not create separate knowledge files, scratch documents, or architecture notes outside the memory system.

Every tool requires:

- `repositoryPath` — absolute path of the repository currently being worked on.

## No MCP? Use the shell

If the `librarian` MCP tools are not available, run the same operations from the repository directory:

```
librarian search "<query>"
librarian read <note>
librarian list
librarian pending
librarian remember --type gotcha --summary "..." [--details "..."] [--files a.swift,b.swift] [--tags x,y] [--agent "<your name>"]
```

If the command is missing, tell the user to install librarian. If a repository is unknown, suggest `librarian add` instead of writing notes elsewhere.

---

# Why Memory Exists

Memory is an index of previously verified knowledge.

Its purpose is to avoid rediscovering architecture, conventions, previous investigations, and historical decisions.

A successful memory search should replace repository exploration, not duplicate it.

Default to searching memory before searching the repository.

---

# When To Search

Before reading repository code, ask yourself:

- Do I need to locate where something lives?
- Do I need to understand architecture?
- Do I need to understand a subsystem?
- Do I need to investigate a bug?
- Do I need to understand a feature?
- Do I need project conventions?
- Do I need historical context?
- Am I about to search the repository?

If YES to any of the above:

1. Search memory.
2. Read the relevant notes.
3. Only then explore repository code.

---

# Search Before Repository Exploration

If your next action would normally be one of these:

- grep
- rg
- find
- fd
- filename search
- symbol search
- broad code browsing

Search memory first.

Memory is significantly cheaper than rediscovering repository structure.

---

# Reading Workflow

Typical workflow:

```
search_memory()

↓

read_note()

↓

read source code

↓

edit
```

Memory provides context.

Source code provides verification.

Never replace code verification with memory.

---

# When You Can Skip Memory

Memory can be skipped when ALL of the following are true:

- you already opened the relevant files during this task
- no architectural context is needed
- the task is confined to code already visible
- you've already searched memory for this topic

Examples:

✅ Rename a local variable inside an already-open file.

✅ Fix a typo in visible code.

✅ Continue editing code already understood.

Examples that SHOULD search:

- "How does subscriptions work?"
- "Where is login implemented?"
- "Why does this flicker?"
- "How is analytics wired?"
- "Where should I implement this feature?"
- "Why does this crash?"
- "How is this architecture organized?"

---

# Reading Tools

## list_notes(repositoryPath)

Use to discover available documentation.

Normally useful at the beginning of work in a repository.

---

## search_memory(repositoryPath, query)

Primary lookup tool.

Prefer natural concepts over filenames.

Good queries:

- subscription flow
- receipt verification
- dashboard flicker
- analytics events
- authentication
- StoreManager

Avoid overly specific filenames unless already known.

---

## read_note(repositoryPath, note)

Read the complete note before acting.

Memory provides context.

Repository code remains the source of truth.

Always verify implementation details in code before making changes.

---

# Writing Knowledge

Record durable knowledge immediately after it is learned.

Do not wait until the task finishes.

Small, accurate memories are better than one large summary.

Use:

```
remember(
    repositoryPath,
    agent,
    type,
    summary,
    ...
)
```

Optional fields:

- details
- files
- confidence
- branch
- tags
- taskId

Reuse the same short `taskId` throughout a task when supported.

---

# What To Remember

Record things future engineers would otherwise need to rediscover.

Good examples:

- architecture decisions
- subsystem relationships
- debugging discoveries
- hidden dependencies
- conventions
- invariants
- fixed bugs
- performance findings
- design rationale
- API contracts
- project-specific gotchas
- knowledge corrections
- durable failed approaches
- user preferences that affect development

Do NOT record:

- obvious code
- temporary implementation details
- git history
- routine edits
- things immediately obvious from reading one file

---

# Memory Types

Prefer the most specific type available.

Examples:

- architecture
- decision
- convention
- gotcha
- fix
- performance
- failed_attempt
- knowledge_correction
- abstained

Routine failures with no reusable lesson should not be recorded.

---

# Canonical Knowledge

Canonical knowledge is read-only.

Never edit files in the knowledge vault (`Knowledge/` of the librarian vault).

Only use `remember()`.

The librarian is responsible for merging events into canonical documentation.

---

# Repository Code Is Truth

Memory is an index.

Repository code is the implementation.

Whenever implementation details matter:

1. Read memory.
2. Verify in code.
3. Make changes.
4. Record new durable knowledge.

Never rely solely on memory for implementation details.

---

# Development Rules

- Record durable knowledge as it is learned, not at the end.
- Prefer searching memory before broad repository exploration.
- Verify every architectural claim against repository code.
- If audited code cannot prove a claim, state exactly:

> "This could not be determined from the audited code."
