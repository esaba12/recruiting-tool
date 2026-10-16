---
phase: 01-visual-foundation-industrial-design-tokens-primitives
plan: 4
subsystem: ui
tags: [react, tailwind, typography, mono, job-boards]

# Dependency graph
requires:
  - phase: 01-visual-foundation-industrial-design-tokens-primitives (Plan 2)
    provides: "app/src/components/ui/Mono.jsx primitive (font-mono text-xs font-normal tabular-nums tracking-wide)"
provides:
  - "JobCard.jsx's deadline badge, posted date, and stale-listing day count, plus JobDetailModal.jsx's posted-date, no-update-days, and deadline-countdown text, rendering via <Mono> — completing VIS-02's third and last named directory (Job Boards) alongside Network (ContactsTable.jsx) and Pipeline (PipelineTab.jsx) from 01-03."
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mono wraps only the pre-formatted date/countdown value at each call site, never the surrounding emoji/label text or the outer conditional-color span/className — color logic (DEADLINE_BADGE/DEADLINE_TEXT urgency-tier maps) stays exactly where it was, Mono adds typography only."
    - "Static status labels ('Rolling — no stated deadline', 'Checking apply page...') are left unwrapped — Mono is reserved for dense numeric/date data per VIS-02's literal scope, not general UI copy."

key-files:
  created: []
  modified:
    - app/src/components/jobBoards/JobCard.jsx
    - app/src/components/jobBoards/JobDetailModal.jsx

key-decisions:
  - "Followed 01-PATTERNS.md's role-match analog (ContactsTable.jsx/PipelineTab.jsx's fmt()-in-span wrap pattern) verbatim, applying the identical Mono-wraps-value-only convention to Job Boards' deadline-countdown and stale-day-count text."

patterns-established: []

requirements-completed: [VIS-02]

coverage:
  - id: D1
    description: "JobCard.jsx's DeadlineBadge label, job.dateAdded, and stale-badge ageDays each wrap only the value in Mono; DEADLINE_BADGE's 3-tier color map is byte-identical to before"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based import/wrap checks (see 01-04-PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "JobDetailModal.jsx's posted-date, no-update ageDays, and full deadline-countdown ternary each wrap only the value in Mono; Rolling/Checking static labels and DEADLINE_TEXT-driven className are unchanged"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based import/wrap checks (see 01-04-PLAN.md Task 2 <verify>)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-16
status: complete
---

# Phase 1 Plan 4: Mono Rollout — Job Boards Deadline/Date Typography Summary

**Wrapped JobCard.jsx's and JobDetailModal.jsx's posted-date, deadline-countdown, and stale-listing day-count text in the shared `<Mono>` primitive, completing VIS-02's rollout across all three RESEARCH.md-named dense-data directories (Network, Pipeline, Job Boards)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-16 (session start)
- **Completed:** 2026-08-16
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `JobCard.jsx`: `DeadlineBadge`'s computed label (`Closed`/`Closes today`/`Closes in Nd`), the card's `job.dateAdded` posted-date span, and the stale badge's `ageDays` count all now render inside `<Mono>` — emoji prefixes, the "d" suffix, and every `DEADLINE_BADGE[tier]` conditional background/text color left byte-identical.
- `JobDetailModal.jsx`: the header's `📅 posted {job.dateAdded}` value, the `👻 No update in {ageDays}d` stale indicator, and the `⏰ {ternary}` deadline-countdown expression all now render inside `<Mono>` — the trailing `({deadline.deadline})` raw apply-page-date parenthetical intentionally left as plain text (per plan spec, it echoes a stated string rather than a computed day-count), and the "Rolling — no stated deadline"/"Checking apply page..." static-label branches left untouched.
- `npm run build` (Vite production build) succeeded with no errors after both edits landed.
- Verified `git diff --stat` against pre-plan HEAD touches exactly the 2 files in the plan's `files_modified` frontmatter.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap JobCard.jsx's date/deadline/stale text in Mono** - `7f1e398` (feat)
2. **Task 2: Wrap JobDetailModal.jsx's date/deadline text in Mono** - `b24537f` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `app/src/components/jobBoards/JobCard.jsx` - `DeadlineBadge` label, `job.dateAdded`, and stale-badge `ageDays` now render via `<Mono>`; added `import Mono from '../ui/Mono.jsx'`
- `app/src/components/jobBoards/JobDetailModal.jsx` - posted-date, no-update `ageDays`, and deadline-countdown ternary now render via `<Mono>`; added `import Mono from '../ui/Mono.jsx'`

## Decisions Made
- Followed `01-PATTERNS.md`'s role-match analog (`ContactsTable.jsx`/`PipelineTab.jsx`'s established `fmt()`-in-`<span>` wrap pattern from 01-03) directly onto Job Boards' deadline-countdown and stale-day-count strings, since the pattern map explicitly named this directory as reusing the identical convention with no new pattern category needed.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated `<verify>` commands passed on first attempt; `git diff --stat` against the pre-plan HEAD confirms exactly 2 files changed (`JobCard.jsx`, `JobDetailModal.jsx`), matching the plan's `files_modified` frontmatter; `npm run build` confirmed a clean production build with no errors after all edits landed.

## Issues Encountered
None. One pre-existing unrelated uncommitted change (`.planning/config.json`, `build_command`/`test_command` fields) was present in the working tree at plan start — left untouched and unstaged, not part of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VIS-02's Mono typography rollout is now complete across all three RESEARCH.md-named directories: Network (`ContactsTable.jsx`, 01-03), Pipeline (`PipelineTab.jsx`, 01-03), and Job Boards (`JobCard.jsx`/`JobDetailModal.jsx`, this plan).
- All pre-existing conditional color logic (`DEADLINE_BADGE`/`DEADLINE_TEXT` urgency-tier maps, stale-badge amber, static Rolling/Checking labels) verified unchanged — Mono added typography only, no color-logic regression risk carried forward.
- This is plan 4 of 5 in Phase 1; one plan remains (01-05) before the phase is complete.

---
*Phase: 01-visual-foundation-industrial-design-tokens-primitives*
*Completed: 2026-08-16*

## Self-Check: PASSED

All modified files verified present on disk with the expected Mono wraps; both task commit hashes (7f1e398, b24537f) verified in git log.
