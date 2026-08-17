---
status: testing
phase: 02-unified-attention-feed-today
source: [02-VERIFICATION.md]
started: 2026-08-17T05:10:00Z
updated: 2026-08-17T05:10:00Z
---

## Current Test

number: 1
name: Full 9-step nav/rendering/deep-link check (carried forward from 02-04-PLAN.md Task 2)
expected: |
  Nav order, section order/rendering, deep-link click-throughs, Timeline Finds chrome, and
  Overview/Calendar/Network cleanup all behave as described in 02-04-PLAN.md; the /demo route
  still works.
awaiting: user response

## Tests

### 1. Full 9-step nav/rendering/deep-link check (carried forward from 02-04-PLAN.md Task 2)
expected: All 9 steps pass as described in 02-04-PLAN.md — nav order, section order/rendering,
  deep-link click-throughs, Timeline Finds chrome, Overview/Calendar/Network cleanup, and the
  /demo route.
result: [pending]

### 2. Timeline-Finds-only-nonempty rendering, re-confirmed against the new hook-based code path (carried forward from 02-05-PLAN.md Task 3)
expected: With an account whose other 8 attention categories are empty but a real pending
  Timeline Finds item exists, Today renders the Timeline Finds section with that item — not the
  page-level "Nothing needs your attention" EmptyState. Now doubly relevant since Plan 02-06
  changed how this count is computed (from a synced useState to useTimelineFinds' live
  pending.length) — needs re-confirmation against the new code path, not just the old one.
result: [pending]

### 3. Day-boundary scan-resumption scenario — this plan's actual fix (new, from 02-06-PLAN.md Task 3 / 02-VERIFICATION.md)
expected: |
  Sign in to a real account, reach a genuinely all-caught-up state (all 9 sections empty,
  including 0 pending Timeline Finds). Open devtools and edit the scoped rec_timeline_meta
  localStorage entry (key <user-id>:rec_timeline_meta) to set lastCheck to a date other than
  today. Add a real future-dated item to a call note, application note, or interaction summary
  that findTimelineEvents() should detect. Reload Today while every other category remains empty.
  The page still shows the single page-level EmptyState on load, but the background scan fires
  anyway (visible in the Network tab as a /claude-api request, or confirm rec_timeline_meta's
  lastCheck advanced to today afterward) — and once it finds the new item, the page self-updates
  to show the Timeline Finds section with that item, no reload needed.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
