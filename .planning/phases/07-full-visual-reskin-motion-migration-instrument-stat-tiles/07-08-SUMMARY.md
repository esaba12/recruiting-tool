---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 08
subsystem: ui
tags: [react, motion, recharts, tailwind, localStorage, instrument-panel]

# Dependency graph
requires:
  - phase: 07-01
    provides: "motion package installed (motion/react resolves)"
  - phase: 07-05
    provides: "TodayTab.jsx's OverdueRow shape, stable base for this plan's ActivitySection/Section-list edits"
provides:
  - "lib/statTiles.js nextDeadlines(apps, limit) — Pipeline-apps × rec_job_deadlines cross-reference"
  - "StatTileRow.jsx — 3-tile instrument-panel readout row (Funnel, Next Deadline, Activity)"
  - "TodayTab.jsx mount-time stagger across its whole Section list + the new tile row"
affects: [today-tab, pipeline, motion-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "motion/react container/rise variants pair (staggerChildren + opacity/y fade), ported from NotFoundPage.jsx's existing precedent"
    - "CSS-based compact sparkline (flex items-end bars) for a dense inline tile, deliberately not reusing charts/BarChart.jsx which has no axis-hiding prop"

key-files:
  created:
    - app/src/lib/statTiles.js
    - app/src/components/StatTileRow.jsx
  modified:
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Next Deadline tile scope is Needs-Review/Applying apps with a sourceRepo (D-07's literal spec) — intentionally the opposite scope from lib/timeline.js's own deadline cross-reference, which excludes Needs-Review apps via !isUntriaged"
  - "StatTileRow.jsx owns its own internal motion/react stagger (separate container/rise-shaped variants), independent of TodayTab's Section-list stagger — matches CONTEXT.md's Claude's-Discretion note that exact stagger-scope wiring is an implementation detail"
  - "Symlinked app/node_modules to the main checkout's node_modules for this worktree (gitignored, not committed) since the worktree had no node_modules and Plan 07-01 already installed motion in the main checkout — avoided a redundant full npm install"

requirements-completed: [STAT-01, VIS-04]

coverage:
  - id: D1
    description: "lib/statTiles.js exports nextDeadlines(apps, limit) — reuses jobId/daysUntilDeadline/lsGet from jobBoards/helpers.js, filtered to Needs-Review/Applying apps with a sourceRepo and a confirmed cached deadline, never fabricates a date for a missing/rolling entry"
    requirement: "STAT-01"
    verification:
      - kind: other
        ref: "grep -c 'export function nextDeadlines' app/src/lib/statTiles.js == 1; grep -c 'jobId\\|daysUntilDeadline\\|lsGet' == 6; grep -c \"'Needs Review'\" == 1; grep -c \"'Applying'\" == 1; grep -c 'rec_job_deadlines' == 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "StatTileRow.jsx renders the 3-tile instrument-panel row (Funnel, Next Deadline, Activity), each numeral via Mono, inserted as the first child of ActivitySection's Section wrapper above the existing funnel/donut/trend charts; Next Deadline fails soft to 'No known deadlines'"
    requirement: "STAT-01"
    verification:
      - kind: other
        ref: "grep -c \"from 'motion/react'\" StatTileRow.jsx == 1; grep -c 'No known deadlines' == 1; grep -c 'rounded-md border border-ink-300' == 3; grep -c 'import StatTileRow' TodayTab.jsx == 1; grep -c '<StatTileRow' TodayTab.jsx == 1 (precedes hasRecruitingActivity in source order)"
        status: pass
      - kind: other
        ref: "cd app && npm run build (vite build, exits 0)"
        status: pass
    human_judgment: true
    rationale: "Grep/build checks confirm structure and successful compilation, but the tile row's actual visual layout, gradient tick-bar proportions, and the Next Deadline fail-soft copy against real localStorage data need a rendered/screenshot pass — deferred to end-of-phase human UAT per workflow.human_verify_mode=end-of-phase (this worktree has no .env, so Supabase-backed dev server can't render here)."
  - id: D3
    description: "TodayTab's outer container and all 10 mount-time blocks (8 conditional Sections, TimelineFindsPanel, ActivitySection) fade/slide in staggered ~100ms apart via motion/react; on-demand SidePanel/LogInteractionModal overlays are left unwrapped"
    requirement: "VIS-04"
    verification:
      - kind: other
        ref: "grep -c \"from 'motion/react'\" TodayTab.jsx == 1; grep -c 'variants={rise}' == 10; grep -c 'variants={container}' == 1; grep -c '<SidePanel' == 2 (unchanged, neither wrapped)"
        status: pass
      - kind: other
        ref: "cd app && npm run build (vite build, exits 0)"
        status: pass
    human_judgment: true
    rationale: "Structural/build checks pass deterministically, but confirming the stagger actually reads as ~100ms-apart and doesn't feel janky/too-fast/too-slow on a real Today page with real data requires a human eye — deferred to end-of-phase UAT, same constraint as D2 (no .env in this worktree)."

# Metrics
duration: 9min
completed: 2026-08-21
status: complete
---

# Phase 07 Plan 08: Instrument-Panel Stat Tiles + Section-List Stagger Summary

**New `lib/statTiles.js` deadline cross-reference + `StatTileRow.jsx` 3-tile instrument-panel row wired into TodayTab's ActivitySection, plus a `motion/react` staggered mount-reveal across TodayTab's entire attention-feed Section list.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-21T17:55:52Z
- **Completed:** 2026-08-21T18:00:11Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `lib/statTiles.js` exports `nextDeadlines(apps, limit = 3)` — cross-references Pipeline apps (Needs-Review/Applying, with a Source Repo) against the `rec_job_deadlines` localStorage cache Job Boards already maintains, reusing `jobId`/`daysUntilDeadline`/`lsGet` from `jobBoards/helpers.js` verbatim
- `StatTileRow.jsx` renders the STAT-01 3-tile "dashboard glance" row (Funnel progress bar, Next Deadline countdown with gradient tick bar, Activity 6-week micro sparkline), additive above `ActivitySection`'s existing Funnel/Donut/Trend Recharts — zero new Supabase/AI calls
- `TodayTab.jsx`'s whole Section list (8 conditional Sections + TimelineFindsPanel + ActivitySection) now fades/slides in staggered ~100ms apart on mount via a `motion/react` `container`/`rise` variants pair, matching the existing `NotFoundPage.jsx` precedent

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/statTiles.js — deadline cross-reference helper (D-07)** - `2e71ea9` (feat)
2. **Task 2: StatTileRow.jsx + wire into TodayTab.jsx's ActivitySection** - `3306a45` (feat)
3. **Task 3: TodayTab.jsx Section-list stagger (D-04)** - `ea05408` (feat)

_No TDD tasks in this plan — all `tdd="false"` or plain `type="auto"`._

## Files Created/Modified
- `app/src/lib/statTiles.js` - New. `nextDeadlines(apps, limit)`, Needs-Review/Applying × `rec_job_deadlines` cache cross-reference, sorted soonest-first
- `app/src/components/StatTileRow.jsx` - New. 3-tile instrument-panel row (Funnel/Next Deadline/Activity), each numeral via `Mono`, self-contained `motion/react` internal stagger
- `app/src/components/TodayTab.jsx` - Modified. `StatTileRow` import + render call inside `ActivitySection`; `motion`/`container`/`rise` added; outer return div and all 10 mount-time blocks wrapped for the D-04 stagger

## Decisions Made
- Next Deadline tile's scope (Needs-Review/Applying + sourceRepo) is deliberately the opposite of `lib/timeline.js`'s existing deadline cross-reference (which excludes Needs-Review via `!isUntriaged`) — this matches D-07's literal spec ("applications you haven't yet acted on"), not a duplicate of the Timeline Finds signal
- `StatTileRow`'s 3-tile stagger uses its own local `container`/`item` variants rather than reusing `TodayTab`'s `container`/`rise` — keeps the tile row's stagger tunable independently and avoids a prop-drilled variants object, per CONTEXT.md's Claude's-Discretion note on this exact question
- Symlinked `app/node_modules` → the main checkout's `app/node_modules` for this worktree (gitignored, untracked, not committed) since the worktree started with no `node_modules` and the two `package.json` files are byte-identical — avoided a redundant multi-minute `npm install` for a dependency (`motion`) Plan 07-01 already installed in the main tree

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps (Task 1: 5/5, Task 2: 6/6, Task 3: 5/5) and both `npm run build` gates passed on the first attempt.

## Issues Encountered

The worktree had no `node_modules` (fresh worktree checkout, not a fresh `npm install`) — resolved by symlinking to the main checkout's `node_modules` (both `package.json` files verified byte-identical via `diff`) rather than re-running a full `npm install`, since the `motion` package was already installed there by Plan 07-01. The symlink is gitignored and was never staged/committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STAT-01 (instrument-panel stat tiles) and this plan's slice of VIS-04 (motion migration — TodayTab's Section list) are both structurally and build-verified complete.
- Visual/UX confirmation of the tile row's layout and the stagger's actual feel is deferred to end-of-phase human UAT (`workflow.human_verify_mode=end-of-phase`) — this worktree has no `.env`, so the Supabase-backed dev server can't render here, matching the same constraint documented in `05-02-SUMMARY.md`.
- No blockers for merging this plan into the phase's combined tree; other Wave-2 dependents (if any) can build on `StatTileRow`/`nextDeadlines` once merged.

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*
