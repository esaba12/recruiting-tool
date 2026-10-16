---
phase: 06-navigation-consolidation-complete
plan: 01
subsystem: ui
tags: [react, recharts, today-tab, navigation]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge
    provides: "ui/Section.jsx's Section/RowCap/HEADING_COLOR primitive, already consumed by TodayTab.jsx"
provides:
  - "TodayTab.jsx gains a module-level weekStart helper and ActivitySection component holding the Application Funnel bar chart, Network by Status donut, and Networking Activity trend chart"
  - "ActivitySection renders unconditionally (both caught-up and has-work paths), satisfying the Interaction Contract that charts must not be hidden behind the all-caught-up EmptyState"
affects: [06-02-navigation-consolidation-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Charts ported into a destination tab as a Section-wrapped block ahead of the source tab's deletion (chrome-and-content-together sequencing, per STATE.md's standing constraint)"

key-files:
  created: []
  modified:
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Sub-heading typography demoted from Section-level h2 (OverviewTab.jsx's text-sm font-semibold) to the locked 12px/600 Label role (text-xs font-semibold text-ink-500 mb-3) for all three chart sub-headings, because they now sit under a Section heading rather than being top-level headings themselves — the single deliberate styling deviation from an otherwise verbatim port, per plan constraint 7"
  - "Dropped the four-tile KPI row, its local KPI() helper, TERMINAL_STAGES/INTERVIEW_STAGES imports, and the mini force-graph preview card (NetworkGraphView + onOpenGraph) — Today's own attention sections already carry that information and the Network tab's Graph view remains one nav click away, per plan constraint 5 / RESEARCH.md Assumption A1"

patterns-established: []

requirements-completed: [NAV-01]

coverage:
  - id: D1
    description: "ActivitySection component ported into TodayTab.jsx holding the funnel/donut/trend charts, not yet rendered"
    requirement: NAV-01
    verification:
      - kind: other
        ref: "Task 1 automated verify block (16 grep/diff assertions + npm run build) — all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "ActivitySection renders on every Today path, including the all-caught-up EmptyState path"
    requirement: NAV-01
    verification:
      - kind: other
        ref: "Task 2 automated verify block (8 grep/diff assertions + npm run build) — all pass"
        status: pass
    human_judgment: true
    rationale: "Automated checks confirm structural placement (indentation, guard clauses, unchanged allEmpty logic) but cannot confirm the charts visually render correct numbers matching OverviewTab.jsx side-by-side, or that a genuinely caught-up account still sees an intact Activity card with no double-bordering — staged for the phase's end-of-phase human-check per workflow.human_verify_mode=end-of-phase"

duration: 8min
completed: 2026-08-20
status: complete
---

# Phase 6 Plan 1: Port Overview's Charts into TodayTab Summary

**Ported the Application Funnel, Network-by-Status donut, and Networking Activity trend chart from `OverviewTab.jsx` into a new `ActivitySection` component in `TodayTab.jsx`, rendered unconditionally so it survives the all-caught-up EmptyState gate.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-08-20
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments

- `TodayTab.jsx` gained a module-level `weekStart` helper and `ActivitySection` component (`{ contacts, apps, interactions }` props) that verbatim-ports the funnel/donut/trend chart computations and markup from `OverviewTab.jsx`, wrapped in one `Section` (`title="Activity"`, `accent="ink"`, `icon={Activity}`) instead of three separate white-card divs.
- The whole-component early return (`if (allEmpty) return <EmptyState .../>`) was replaced with an inline conditional child, so the eight existing attention sections keep their exact guards/indentation and the new `ActivitySection` renders on every path — including when a user is fully caught up.
- `TimelineFindsPanel`'s render guard gained a negated `allEmpty` clause (`!isDemoMode && !allEmpty`), preserving its pre-existing mount behavior byte-for-byte (it never mounted on a caught-up render before this plan, via the deleted early return; now it doesn't mount via an explicit guard instead).
- `OverviewTab.jsx` is untouched and still fully live — this plan touched exactly one file, per the plan's hard constraint 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the three charts into a module-level ActivitySection component** - `ace6341` (feat)
2. **Task 2: Render ActivitySection outside the caught-up gate** - `f24792f` (feat)

**Plan metadata:** this SUMMARY's own commit (docs)

## Files Created/Modified

- `app/src/components/TodayTab.jsx` - Gained `weekStart` helper, `ActivitySection` component (Task 1), and its unconditional render replacing the whole-component EmptyState early return (Task 2). 554 lines (was 463 before this plan).

## Consts ported vs. deliberately dropped

**Ported verbatim** (feed the three retained charts): `triagedApps`, `hasRecruitingActivity`, `stageCounts`, `funnelStages`, `funnelData`, `conversions`, `donutData`, `trendWeeks`, `trendData`, `hasInteractions`, plus the module-level `weekStart` helper.

**Deliberately dropped** (fed only the two dropped blocks — four-tile KPI row and mini force-graph preview): `activeApps`, `interviews`, `offers`, `warmContacts`, `companyCount`. The local `KPI()` helper, the `TERMINAL_STAGES`/`INTERVIEW_STAGES` imports, and the `NetworkGraphView` import/`onOpenGraph` callback prop were not carried over — verified absent via the Task 1 verify block's zero-occurrence grep gate.

## One styling deviation from a verbatim port

Per plan constraint 7: the three chart sub-headings (`Application Funnel`, `Network by Status`, `Networking Activity`) demoted from `OverviewTab.jsx`'s `text-sm font-semibold text-ink-700` (top-level `<h2>` styling) to the locked 12px/600 Label role, `text-xs font-semibold text-ink-500 mb-3` (`<h3>`), because they now sit *under* the `Section`'s own `<h2>` heading ("Activity") rather than being top-level headings themselves. This is the only deviation from an otherwise byte-for-byte port of the chart markup, computations, and empty-state copy.

## Decisions Made

- Followed the plan's exact task ordering: Task 1 authored `ActivitySection` fully self-contained and unrendered (tree builds, behavior unchanged), Task 2 did the minimal-diff render-shape surgery. No deviation from the plan's stated rationale.
- No architectural decisions beyond what the plan specified — this was a verbatim-port task with one pre-authorized styling deviation (constraint 7, documented above).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- This worktree checkout had no `app/node_modules` (git-ignored, not present in a fresh worktree). Ran `npm install` once before Task 1's build verification (229 packages, ~3s) so the `npm run build` gates could run for both tasks — infrastructure setup required to execute the plan's own verification commands, not a plan deviation. Same pattern as Phase 5 Plan 1's worktree.
- The sandbox's Bash tool rejected several multi-command `&&`-chained invocations and one `diff <(...)` process-substitution invocation as "too complex to verify stays inside the worktree." Worked around by running each grep/test assertion as its own Bash call and extracting `git show` blobs to the scratchpad directory before diffing with plain file arguments — no effect on verification correctness, every plan-specified check still ran and passed with its exact expected value.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `TodayTab.jsx` now contains the full `ActivitySection` — Plan 06-02 can proceed to shrink `Sidebar.jsx`'s `NAV_ITEMS` (7→5), relocate Settings to the footer, delete `OverviewTab.jsx`, and remove its `tab === 'overview'` render branches in `App.jsx` (both `AppInner` and `DemoApp`) without losing any user-visible content.
- The charts are temporarily visible in two places (Today and the still-live Overview tab) for this one wave, exactly as the plan's objective describes — this is expected, not a defect, and resolves once Plan 06-02 lands.
- Human-check for this plan (charts render correctly on both caught-up and has-work paths, numbers match Overview side-by-side, single-card no-double-border layout) is staged for the phase's end-of-phase manual pass per `workflow.human_verify_mode=end-of-phase` — not run inline in this worktree (no `.env`/Supabase client available in isolation).

---
*Phase: 06-navigation-consolidation-complete*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: app/src/components/TodayTab.jsx
- FOUND: commit ace6341 (Task 1)
- FOUND: commit f24792f (Task 2)
