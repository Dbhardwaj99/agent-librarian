# Librarian

Project memory for coding agents

**Project memory report · 17 June – 08 Oct 2026**

<!-- Page 1 -->

## A record of real use

Keep the architecture, decisions and fixes learned in one session available to the next. Librarian turns those findings into a wiki that is checked against your source code.

{Explain what the project even is, what it does, how it does and how simple it is in 2-3 lines}

| Metric | Value |
| --- | ---: |
| Memory calls | 2,638 |
| Findings recorded | 500 |
| Active days | 54 |

### How I have used it

I have used this memory workflow with Claude Code and Codex since 17 June (I added logging to analyse how it is doing later). The record covers nearly three months, with activity in July, August, September and October.

The wider workflow contains 39,904 tool calls, including 4,436 identifiable MCP calls. The memory server recorded the 2,638 calls shown above. These are separate views of usage, so their counts are not added together.

### The habit that makes memory useful

- **Recall:** Find the relevant note before exploring the repository.
- **Verify:** Check the source files needed for the current change.
- **Improve:** Record what changed. The scheduled Librarian audits it.

Sources: vault transcript export and server log. Static transcript extraction can miss calls inside batches.

<!-- Page 2 -->

## Three months of project knowledge

### Knowledge that builds with each investigation

By the end of July, the log contained 187 findings. By 8 October, it contained 500. Each useful addition gives a later session something it can reuse.

### Recorded findings

| Period | Recorded findings |
| --- | ---: |
| Jul 13–31 | 187 |
| August | 315 |
| September | 400 |
| Oct 1–8 | 500 |

Cumulative remember events. These are proposals, not a count of unique facts. July and October are partial months.

| Period | All tools | Memory | Total findings | Log to date |
| --- | ---: | ---: | ---: | ---: |
| Jul 13–31 | 10,094 | 875 | 187 | 299 KiB |
| August | 13,092 | 1,077 | 315 | 628 KiB |
| September | 10,800 | 360 | 400 | 765 KiB |
| Oct 1–8 | 5,918 | 326 | 500 | 900 KiB |

The memory calls include 1,302 note reads and 674 searches. Agents also recorded 500 findings, listed notes 132 times and checked pending updates 30 times.

The vault snapshot contains 325 project notes. The event history includes 105 knowledge corrections and 122 gotchas. Log sizes are cumulative reserialized UTF-8 JSONL. Monthly call counts vary with workload; they are not productivity scores.

<!-- Page 3 -->

## The economics of reuse

### How repeat work can save 30 percent

A known answer can replace another round of discovery. The saving comes from reaching the right source files faster while keeping the checks needed for the change.

| Metric | Value |
| --- | ---: |
| Tokens per median note | ~207 |
| Requests revisit a note | 970 |

Measured: the median of 1,160 note bodies is 826 characters (~207 tokens at 4 chars/token). Of 1,302 requests, 970 revisit a note after project aliases are normalized.

| Task input budget | No memory | With Librarian |
| --- | ---: | ---: |
| Locate the known answer | 3,250 | 0 |
| Task work and source checks | 4,750 | 4,750 |
| Read the note and maintain it | 0 | 207 + 400 |
| Build cost over 20 reuses | 0 | 4,400 / 20 |
| Total token equivalents | 8,000 | 5,577 |

### 2,423 fewer tokens

(8,000 - 5,577) / 8,000 = 30.3%

| Reuses | Savings |
| ---: | ---: |
| 10 | 27.5% |
| 20 | 30.3% |
| 50 | 31.9% |

**What must be true.** This example assumes an 8,000-token task and that the note replaces all 3,250 locating tokens. The prior local audit estimated those locating tokens and a 4,400-token build cost per note. Ongoing upkeep is budgeted at 400 tokens per reuse;

For 30%, total memory overhead must stay below 850 tokens. This model uses 827. Use a known note path: the prior audit estimated a broad search at 4,235 tokens. These are conditional input-volume savings, not measured billed savings. Source: memory-layer-efficiency-forensics.md and MCP server log.

<!-- Page 4 -->

## Librarian and a Similar repo [(Agent Memory)](https://github.com/AgentMemoryRepo/agentmemoryrepo)

### Two ways to keep project knowledge

Both keep linked memory in Git. Agent Memory Repo offers a flexible format and a skill. Librarian packages a workflow for coding agents, with structured capture and scheduled source audits.

| Workflow | Agent Memory Repo | Librarian |
| --- | --- | --- |
| Recall | Read MEMORY.md, grep notes or follow links. | Search project notes through MCP or the CLI. Read a specific note when its path is known. |
| Capture | Agents edit notes directly and commit changes. | Agents append separate proposal files. The Librarian merges accepted findings into the wiki. |
| Maintain | The spec describes periodic Dreaming to merge, clean up and check sources. The trial adds no scheduler. | A packaged scheduler runs source audits. Note size and link checks keep the wiki navigable. |
| Set up | Invoke the skill. The trial is local; sharing uses persistent storage or a private remote. | Init wires supported agent clients and schedules the Librarian. Add registers each repository. |
| A useful fit | Personal and team memory, including saved queries, scripts and linked context. | Repeated coding work across repositories where decisions and fixes need ongoing source verification. |

### Why I use Librarian

I want findings from today's investigation to be available next time, with a routine that checks them as the code changes. The benefit depends on agents using that knowledge to narrow their work.

### Try it on a repository you revisit

[github.com/Dbhardwaj99/librarian](https://github.com/Dbhardwaj99/librarian)

Sources: project READMEs and skills, checked 8 Oct 2026. No head-to-head token benchmark.
