# 07 — Docs restructure (slim CLAUDE.md)

**Status:** ✅ merged 2026-10-17 (PR #13).

## Problem

`CLAUDE.md` had grown to **118 KB**, a dated changelog of every feature since July. It loads
into every Claude Code session, so each session paid for about 30k tokens of history before
doing anything. It had also gone stale in places that cause wrong edits:

- The stack table said "LeetNotion: pending install" (superseded by Learn's LeetCode sync).
- The proxy table said `/claude-api` is "vision only now" and `/openai-api` is "every other AI
  call", which is backwards: Claude has been the default since 2026-07-23.
- The repo map listed folders removed in [06](06-prune-and-refactor.md) and called Discover and
  Explore Network views and a top-level tab (both are in Grow now).
- The AI section described `VITE_AI_PROVIDER` as *the* switch. Since v1.2 the provider is a per-user Settings choice.
- "Features Researched — Next to Build" listed five features. Four have shipped (SimplifyJobs
  feed, company problem sets, outreach drafter, coverage map); the fifth (JD fit scorer) is
  mostly covered by Job Boards' fit analysis.
- "Pending Setup" duplicated, and contradicted, the v1.2 ops checklist.

## What changed

- **`CLAUDE.md` → about 10 KB:** what the repo is, stack, commands, repo map, the rules that
  prevent real bugs (security model, proxy order, function cap, AI entry point, demo guards,
  storage, tokens, process), cross-cutting gotchas, known issues, and an index.
- **`docs/architecture/*.md` (12 files):** every feature section moved **word for word**
  (nothing deleted), grouped by topic, each with a header saying dated notes are history. Fixed
  while moving: the proxy route table (rewritten from `app/vercel.json`), the Keep in
  Touch/Discover/Explore headings, the LC Problems row, a "per user now" note on the AI switch.
- **Dropped** (stale and covered elsewhere): "Actual Stack (as of July)", the old repo
  structure, "Pending Setup" (→ [02](02-owner-runbook.md)) and "Features Researched".
- **README:** the repo map now points at `docs/architecture/`.

## Keeping it slim (rule for future work)

- A new feature gets **one or two lines** in CLAUDE.md, and only if it adds a rule or gotcha
  every session needs. The narrative goes in the matching `docs/architecture/` file, or a new file listed in the index.
- Status ("shipped", "verified live", "not yet done") goes in `.planning/`, not CLAUDE.md.
- If CLAUDE.md passes about 20 KB again, move the oldest topic out.
