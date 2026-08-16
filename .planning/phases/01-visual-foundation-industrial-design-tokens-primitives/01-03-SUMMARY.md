---
phase: 01-visual-foundation-industrial-design-tokens-primitives
plan: 3
subsystem: ui
tags: [react, tailwind, typography, mono, contacts-table, pipeline]

# Dependency graph
requires:
  - phase: 01-visual-foundation-industrial-design-tokens-primitives (Plan 2)
    provides: "app/src/components/ui/Mono.jsx primitive (font-mono text-xs font-normal tabular-nums tracking-wide)"
provides:
  - "ContactsTable.jsx's Last/Follow-Up date columns and PipelineTab.jsx's duplicate-group/applied/closed dates + stage-age day count rendering via <Mono>, closing out VIS-02's two highest-traffic call sites named by RESEARCH.md Pattern 3."
affects: ["01-04 (remaining Mono rollout: JobCard.jsx/JobDetailModal.jsx in jobBoards/)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mono wraps only the pre-formatted fmt()/numeric value at each call site, never the surrounding label text or the outer conditional-color span/className — color logic stays exactly where it was, Mono adds typography only."
    - "When a call site already had a color-conditional span wrapping the value (ContactsTable's overdue Follow-Up cell), the className moves onto Mono itself rather than nesting Mono inside a redundant outer span."

key-files:
  created: []
  modified:
    - app/src/components/ContactsTable.jsx
    - app/src/components/PipelineTab.jsx

key-decisions:
  - "Followed 01-PATTERNS.md's exact edit pattern verbatim for both files — no interpretation required, the current code and required diff were both already fully specified."

patterns-established: []

requirements-completed: [VIS-02]

coverage:
  - id: D1
    description: "ContactsTable.jsx's lastInteraction and followUpDate columns wrap fmt() output in Mono, with the overdue-red conditional preserved on Mono's className"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based import/cell-wrap checks (see 01-03-PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PipelineTab.jsx's 4 named call sites (duplicate-group date, applied-date, closed-date, stage-age day count) wrap only the value in Mono, surrounding text/color wrappers unchanged; ApplicationDetailModal.jsx untouched"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based cell-wrap checks + git diff --stat confirming ApplicationDetailModal.jsx zero diff (see 01-03-PLAN.md Task 2 <verify>)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-16
status: complete
---

# Phase 1 Plan 3: Mono Rollout — ContactsTable + PipelineTab Date/Day-Count Columns Summary

**Wrapped Network table's Last/Follow-Up columns and Pipeline's applied/closed-date + stage-age displays in the shared `<Mono>` primitive, replacing default Public Sans body font on the app's two highest-traffic dense-data surfaces**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-16 (session start)
- **Completed:** 2026-08-16
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ContactsTable.jsx`: `lastInteraction` column's `fmt(info.getValue())` now renders inside `<Mono>`; `followUpDate` column's `<span className={overdue ? ...}>` was replaced by `<Mono className={overdue ? ...}>`, avoiding a redundant nested element while preserving the exact overdue-red conditional.
- `PipelineTab.jsx`: 4 call sites now render through Mono — the duplicate-group meta line's `fmt(a.createdTime)`, the "Applied {date}" span's date value, the "Closed {date} (Nd)" span's date value (day-count suffix untouched), and the stage-age `{days}d in stage` display's numeric day count (stale-amber conditional on the outer span untouched).
- Verified `ApplicationDetailModal.jsx` has zero diff from this plan, per its explicit out-of-scope exclusion (duplicate-count headline stays on `font-heading` + `tabular-nums`).
- `npm run build` (Vite production build) succeeded with no errors after both edits landed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap ContactsTable.jsx's date columns in Mono** - `c578832` (feat)
2. **Task 2: Wrap PipelineTab.jsx's date/day-count displays in Mono** - `c6e61e3` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `app/src/components/ContactsTable.jsx` - `lastInteraction`/`followUpDate` columns now render via `<Mono>`; added `import Mono from './ui/Mono.jsx'`
- `app/src/components/PipelineTab.jsx` - duplicate-group date, applied-date, closed-date, stage-age day count now render via `<Mono>`; added `import Mono from './ui/Mono.jsx'`

## Decisions Made
- Followed `01-PATTERNS.md`'s exact pre-specified diff verbatim for both files — the current code and required edit pattern were both already fully documented from a direct prior read, leaving no open interpretation.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated `<verify>` commands passed on first attempt; `git diff --stat` against the pre-plan HEAD confirms exactly 2 files changed (`ContactsTable.jsx`, `PipelineTab.jsx`), matching the plan's `files_modified` frontmatter and `ApplicationDetailModal.jsx`'s explicit zero-diff exclusion; `npm run build` confirmed a clean production build with no errors after all edits landed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `Mono.jsx` rollout is now live on the app's two highest-traffic dense-data surfaces (Network table, Pipeline cards) — VIS-02's core evidence call sites from RESEARCH.md Pattern 3 are resolved.
- Remaining Mono rollout scope (Job Boards' `JobCard.jsx`/`JobDetailModal.jsx` posting-date/deadline badges, per 01-02-SUMMARY.md's `affects` note) is deferred to 01-04, not blocked by anything in this plan.
- All pre-existing conditional color logic (overdue red on Follow-Up, stale amber on stage-age) verified unchanged — Mono added typography only, no color-logic regression risk carried forward.

---
*Phase: 01-visual-foundation-industrial-design-tokens-primitives*
*Completed: 2026-08-16*

## Self-Check: PASSED

All modified files verified present on disk with the expected Mono wraps; both task commit hashes (c578832, c6e61e3) verified in git log.
