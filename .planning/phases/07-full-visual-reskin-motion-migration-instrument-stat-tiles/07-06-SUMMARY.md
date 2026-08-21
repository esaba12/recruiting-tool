---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 06
subsystem: ui-shape-sweep
tags: [visual-reskin, shape-system, D-02, bordered-flat]
dependency-graph:
  requires: []
  provides: [ChartTooltip-bordered-flat]
  affects: [ContactsTable.jsx, jobBoards/CalendarView.jsx, charts/ChartTooltip.jsx, LoginPage.jsx, OutboxTab.jsx, AddToCalendarModal.jsx, charts/BarChart.jsx, charts/DonutChart.jsx, charts/TrendChart.jsx]
tech-stack:
  added: []
  patterns: ["bordered-flat card (rounded-md/border-ink-300, no persistent shadow)"]
key-files:
  created: []
  modified:
    - app/src/components/ContactsTable.jsx
    - app/src/components/jobBoards/CalendarView.jsx
    - app/src/components/charts/ChartTooltip.jsx
    - app/src/components/LoginPage.jsx
    - app/src/components/OutboxTab.jsx
    - app/src/components/AddToCalendarModal.jsx
decisions:
  - "LoginPage.jsx's active sign-in/sign-up tab pill indicator (shadow-sm, x2) preserved unchanged — a toggle-state affordance, not a static container per D-01's Card/SidePanel/Modal/Section scope"
  - "AddToCalendarModal.jsx's textarea, image preview, upload-prompt button, and error/success banners (rounded-xl) left untouched — form-input/alert radius is out of D-01's container scope; only the extracted-event review card was flattened"
metrics:
  duration: 8min
  completed: 2026-08-21
status: complete
---

# Phase 7 Plan 06: Table/Tooltip/Auth/Message/Review Card Shape Sweep Summary

Continued the D-02 systematic shape-sweep, flattening 6 remaining generic-card instances — a data table wrapper, a calendar month-grid card, the shared Recharts tooltip (one fix inherited by 3 chart consumers), the auth card, a message-row card, and a screenshot-review card — from `rounded-xl`/`rounded-2xl` + `shadow-sm` + `border-ink-100` to the bordered-flat `rounded-md` + `border-ink-300` system, with zero shadow.

## What Was Built

**Task 1 — `ContactsTable.jsx` + `jobBoards/CalendarView.jsx`:**
- `ContactsTable.jsx` line 133: table's outer wrapper `bg-white rounded-xl border border-ink-100 shadow-sm overflow-x-auto` → `bg-white rounded-md border border-ink-300 overflow-x-auto`.
- `jobBoards/CalendarView.jsx` line 32: month-grid card `bg-white rounded-xl p-5 shadow-sm border border-ink-100` → `bg-white rounded-md p-5 border border-ink-300`.

**Task 2 — `charts/ChartTooltip.jsx` + `LoginPage.jsx`:**
- `charts/ChartTooltip.jsx` line 6: `bg-white border border-ink-100 shadow-sm rounded-xl px-3 py-2 text-xs` → `bg-white border border-ink-300 rounded-md px-3 py-2 text-xs`. This is a shared component consumed by `charts/BarChart.jsx`, `DonutChart.jsx`, and `TrendChart.jsx` — the fix propagates to all 3 chart wrappers' Recharts tooltips with zero chart-wrapper edits.
- `LoginPage.jsx` line 66: auth card `bg-white rounded-2xl border border-ink-100 shadow-sm p-6` → `bg-white rounded-md border border-ink-300 p-6`.
- `LoginPage.jsx` lines 69/73: the active sign-in/sign-up segmented-toggle indicator pill's `shadow-sm` — left **unchanged**. This is an interactive toggle-state indicator inside a pill-shaped selector (the same category as a Button's hover/focus state), not a static container per D-01's Card/SidePanel/Modal/Section scope.

**Task 3 — `OutboxTab.jsx` + `AddToCalendarModal.jsx`:**
- `OutboxTab.jsx` line 9: `OutboxRow`'s message card `bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100` → `bg-white rounded-md px-4 py-3 border border-ink-300`.
- `AddToCalendarModal.jsx` line 175: the extracted-event review card `space-y-3 bg-white rounded-xl p-4 border border-ink-100 shadow-sm` → `space-y-3 bg-white rounded-md p-4 border border-ink-300`. The file's textarea, image preview, dashed-border upload-prompt button, and error/success alert banners (all `rounded-xl`, unrelated form-input/alert elements) were left untouched per the plan's explicit scope boundary.

## Deviations from Plan

None — plan executed exactly as written. One documentation note (not a deviation): the plan's overall `<verification>` block (`grep -rc "shadow-sm\|rounded-xl\|rounded-2xl" ...` summing to 0 across all 5 non-LoginPage files) is broader than the per-task `acceptance_criteria`, which correctly scope only to the specific container class strings touched. `AddToCalendarModal.jsx` still contains 5 legitimate `rounded-xl` instances after this plan (error banner, image preview, upload-prompt button, textarea, success banner) — all explicitly excluded from Task 3's scope ("Do not touch the file's textarea ... or any other field"). Task-level acceptance criteria (the authoritative per-task contract) all pass; the overall verification grep is a plan-authoring imprecision, not a shortfall in this plan's execution.

## Verification Results

- Task 1: `grep -c "shadow-sm\|rounded-xl" ContactsTable.jsx CalendarView.jsx` sums to 0. `grep -c "border-ink-300"` sums to 2. PASS.
- Task 2: `grep -c "rounded-xl" ChartTooltip.jsx` = 0. `grep -c "rounded-2xl" LoginPage.jsx` = 0. `grep -c "border-ink-300" LoginPage.jsx` = 1. `grep -c "shadow-sm" LoginPage.jsx` = 2 (both active-tab-pill indicators, unchanged by design). `grep -c "shadow-sm" ChartTooltip.jsx` = 0. PASS.
- Task 3: `grep -c "shadow-sm" OutboxTab.jsx AddToCalendarModal.jsx` sums to 0. `grep -c "rounded-md px-4 py-3 border border-ink-300" OutboxTab.jsx` = 1. `grep -c "rounded-md p-4 border border-ink-300" AddToCalendarModal.jsx` = 1. PASS.
- Production build (`cd app && npm run build`): **not run** — `node_modules` is not installed in this isolated worktree (a known limitation of parallel worktree agents, previously documented in `05-02-SUMMARY.md`). All edits in this plan are minimal, scoped `className` string replacements with zero JS/JSX structural changes, so build risk is negligible; the orchestrator's end-of-wave regression sweep against the fully-merged tree is the correct place to run the real build check.

## Self-Check: PASSED

- FOUND: app/src/components/ContactsTable.jsx
- FOUND: app/src/components/jobBoards/CalendarView.jsx
- FOUND: app/src/components/charts/ChartTooltip.jsx
- FOUND: app/src/components/LoginPage.jsx
- FOUND: app/src/components/OutboxTab.jsx
- FOUND: app/src/components/AddToCalendarModal.jsx
- FOUND: 51b3ebc (Task 1 commit)
- FOUND: b59544d (Task 2 commit)
- FOUND: 71481d9 (Task 3 commit)
