---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 05
subsystem: ui
tags: [tailwind, react, shape-system, modal, card]

# Dependency graph
requires:
  - phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
    provides: "D-02 bordered-flat shape system pattern (rounded-t-md/md:rounded-md + border-ink-300, no persistent shadow-sm) established by ui/Modal.jsx (Plan 07-01) and applied to card-row components in Plan 07-04"
provides:
  - "AddEventModal.jsx and EventDetailModal.jsx hand-rolled modal shells converted to the bordered-flat shape system"
  - "LogInteractionModal.jsx's 2 inline content cards (Contact, Summary) converted to bordered-flat"
  - "KeepInTouchTab.jsx row card and TodayTab.jsx's KeepInTouchRow (plan labeled it OverdueRow) converted to bordered-flat, hover:shadow-md preserved"
affects: [07-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal shell shape: rounded-t-md md:rounded-md border border-ink-300 (no shadow-2xl) — matches ui/Modal.jsx"
    - "List-row card shape: rounded-md border-ink-300, drop persistent shadow-sm, keep hover:shadow-md as interaction feedback"

key-files:
  created: []
  modified:
    - app/src/components/AddEventModal.jsx
    - app/src/components/EventDetailModal.jsx
    - app/src/components/LogInteractionModal.jsx
    - app/src/components/KeepInTouchTab.jsx
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Followed the plan's explicit <action> line-scoped edits (not the broader global-grep acceptance_criteria) when the two conflicted in LogInteractionModal.jsx and KeepInTouchTab.jsx — unrelated rounded-xl usages on alert/banner/header elements outside the targeted card pattern were left untouched as out of scope"
  - "TodayTab.jsx line 174 belongs to a function named KeepInTouchRow, not OverdueRow as the plan's read_first labeled it — edited it anyway since the exact string/line content matched the plan's <action> verbatim; the real OverdueRow (line 37) has no shadow-sm card pattern to fix"

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "AddEventModal.jsx and EventDetailModal.jsx modal shells render bordered-flat (rounded-t-md/md:rounded-md, border-ink-300, no rounded-2xl/shadow-2xl)"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c 'rounded-2xl\\|shadow-2xl' app/src/components/AddEventModal.jsx app/src/components/EventDetailModal.jsx (sums to 0); grep -c 'border-ink-300' sums to 2; grep -c 'bg-purple-100 text-purple-700' EventDetailModal.jsx returns 1 (school-slot badge untouched)"
        status: pass
    human_judgment: false
  - id: D2
    description: "LogInteractionModal.jsx's 2 inline content cards (Contact, Summary) render bordered-flat with no shadow-sm; autocomplete dropdown shadow-lg left as a documented exception"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c shadow-sm app/src/components/LogInteractionModal.jsx returns 0; grep -c border-ink-300 returns 2; grep -c shadow-lg returns 1 (dropdown, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "KeepInTouchTab.jsx row card and TodayTab.jsx's row card render bordered-flat with no persistent shadow-sm; hover:shadow-md interaction feedback preserved on both"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c shadow-sm app/src/components/KeepInTouchTab.jsx app/src/components/TodayTab.jsx sums to 0; grep -c hover:shadow-md sums to 2; grep -c border-ink-300 TodayTab.jsx returns 1"
        status: pass
    human_judgment: true
    rationale: "className-only edits verified via grep/AST parse (no node_modules available in this worktree to run npm run build); a visual smoke check of the modal shells and row-card hover states in a running dev server is recommended before merge, consistent with the phase's visual reskin nature"

duration: 3min
completed: 2026-08-21
status: complete
---

# Phase 07 Plan 05: Modal Shells + List-Row Card Shape Sweep Summary

**Converted AddEventModal/EventDetailModal's hand-rolled modal shells and 3 remaining list-row card instances (LogInteractionModal x2, KeepInTouchTab, TodayTab) from rounded-xl/2xl + shadow-sm/2xl to the bordered-flat rounded-md/border-ink-300 shape system, preserving documented shadow exceptions (autocomplete dropdown elevation, hover:shadow-md interaction feedback).**

## Performance

- **Duration:** ~3 min (git commit timestamps: 10:39:21–10:41:03)
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- `AddEventModal.jsx` and `EventDetailModal.jsx` modal shells now match `ui/Modal.jsx`'s bordered-flat treatment (rounded-t-md/md:rounded-md, border-ink-300, no rounded-2xl/shadow-2xl)
- `LogInteractionModal.jsx`'s Contact and Summary inline cards converted to bordered-flat; the floating autocomplete-suggestion dropdown's `shadow-lg` deliberately left untouched (elevation cue, not a primary container per D-01)
- `KeepInTouchTab.jsx`'s row card and `TodayTab.jsx`'s equivalent row card (the plan's `<read_first>` mislabeled this as `OverdueRow`; it's actually `KeepInTouchRow`) both converted to bordered-flat with `hover:shadow-md` interaction feedback preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: AddEventModal.jsx + EventDetailModal.jsx modal-shell shape** - `8048217` (style)
2. **Task 2: LogInteractionModal.jsx inline cards** - `bb59662` (style)
3. **Task 3: KeepInTouchTab.jsx row card + TodayTab.jsx OverdueRow shape** - `e749ca6` (style)

_All 3 tasks were pure className-string edits — no test/feat/refactor split needed (not TDD)._

## Files Created/Modified
- `app/src/components/AddEventModal.jsx` - Modal shell shape (line 34): rounded-2xl/shadow-2xl → rounded-t-md/md:rounded-md/border-ink-300
- `app/src/components/EventDetailModal.jsx` - Modal shell shape (line 35): same fix; purple school-slot badge untouched
- `app/src/components/LogInteractionModal.jsx` - Contact card (line 207) and Summary card (line 238): rounded-xl/shadow-sm/border-ink-100 → rounded-md/border-ink-300; autocomplete dropdown (line 282) untouched
- `app/src/components/KeepInTouchTab.jsx` - Row card (line 41): same fix, hover:shadow-md preserved
- `app/src/components/TodayTab.jsx` - Row card (line 174, inside `KeepInTouchRow`): same fix, hover:shadow-md preserved; sole edit to this file — `ActivitySection`/stat-tile/motion work is Plan 07-08's scope

## Decisions Made
- Where the plan's `<action>` (explicit line-scoped edits) conflicted with its `<acceptance_criteria>` (global `grep -c "rounded-xl"` expecting 0), followed the `<action>` text literally. The residual `rounded-xl` instances in `LogInteractionModal.jsx` (lines 181, 197, 253, 264, 314 — error/success banners, a textarea, an accent-tinted callout) and `KeepInTouchTab.jsx` (line 19 — a header/summary bar) are different visual patterns (different backgrounds: `bg-danger-50`/`bg-accent-50`/`bg-success-50`, no `shadow-sm`) not covered by the "generic-card" `bg-white...border-ink-100...shadow-sm` pattern this task targets, and weren't named in the plan's `<action>`. Left unchanged per the SCOPE BOUNDARY guidance (out-of-scope elements not caused by this task).
- Edited `TodayTab.jsx` line 174 despite the plan's `<read_first>` mislabeling its containing function as `OverdueRow` (it's actually `KeepInTouchRow`, defined at line 169; the real `OverdueRow` at line 37 has a completely different `<div className="py-2.5">` shape with no shadow-sm pattern). The line number and exact className string in the plan's `<action>` matched line 174 verbatim, confirming it was the intended target — proceeded with the edit and documented the mislabel here rather than treating it as a blocker.

## Deviations from Plan

None requiring a fix — both items above are documentation clarifications about how the plan's own `<action>`/`<acceptance_criteria>`/`<read_first>` blocks were reconciled, not code bugs or missing functionality. No Rule 1-4 auto-fixes were needed; every edit was a direct 1:1 application of the plan's specified className changes.

## Issues Encountered
- `cd app && npm run build` could not run — this worktree has no `node_modules` installed (worktrees don't share `node_modules` with the main checkout and none was provisioned here). Verified correctness instead via: (1) exact grep-count acceptance criteria for every task, all passing except the two documented out-of-scope residuals above; (2) `@babel/parser` (borrowed from the main repo's `node_modules`) successfully parsed all 5 modified files as valid JSX with zero syntax errors. All edits are single-line className string substitutions with no structural/logic changes, so build risk is minimal, but a `npm run build` + visual smoke test in a fully-provisioned environment is recommended before this phase ships.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 files in this plan's scope now render the bordered-flat shape system; `TodayTab.jsx`'s row-card edit was scoped narrowly to leave the file's `ActivitySection`/stat-tile/motion surface untouched for Plan 07-08 (Wave 2), which depends on this plan landing first.
- No blockers. The two documented out-of-scope `rounded-xl` residuals (banners/callouts in `LogInteractionModal.jsx` and a header bar in `KeepInTouchTab.jsx`) are not part of the "generic-card" D-02 pattern this plan targets and don't block Plan 07-08 or any other Wave 2 plan.

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: app/src/components/AddEventModal.jsx
- FOUND: commit 8048217
- FOUND: commit bb59662
- FOUND: commit e749ca6
