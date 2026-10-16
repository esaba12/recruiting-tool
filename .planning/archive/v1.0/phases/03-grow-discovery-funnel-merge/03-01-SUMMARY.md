---
phase: 03-grow-discovery-funnel-merge
plan: 01
subsystem: ui
tags: [react, tailwind, component-extraction]

# Dependency graph
requires:
  - phase: 02-unified-attention-feed-today
    provides: "TodayTab.jsx's Section/RowCap/HEADING_COLOR pattern (private, module-scope, proven across 8 call sites)"
provides:
  - "app/src/components/ui/Section.jsx — reusable Section/RowCap/HEADING_COLOR trio, exported for the first time"
  - "Section's new optional `step` prop (Mono-styled step-index badge) for Grow's 3 later sections"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared page-section shell (Section/RowCap) now lives in ui/ and is importable by any tab, not just TodayTab"

key-files:
  created:
    - app/src/components/ui/Section.jsx
  modified:
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Extracted Section/RowCap/HEADING_COLOR verbatim (byte-identical Tailwind classes/JSX structure) to guarantee zero visual regression on Today's 8 existing call sites"
  - "step prop renders only when truthy, so Today's call sites (which never pass it) are unaffected — pure additive change"

patterns-established:
  - "ui/Section.jsx: shared page-section shell + row-cap-with-expand pattern, now the canonical home for both, used by any future tab needing the same shell (Grow's 3 sections in later plans)"

requirements-completed: [GROW-01]

coverage:
  - id: D1
    description: "Section/RowCap/HEADING_COLOR extracted from TodayTab.jsx into a new shared app/src/components/ui/Section.jsx, exporting all three as named exports"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -n \"export { Section, RowCap, HEADING_COLOR }\" app/src/components/ui/Section.jsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "TodayTab.jsx imports Section/RowCap/HEADING_COLOR from ./ui/Section.jsx instead of declaring them locally; all 8 pre-existing <Section>/<RowCap> call sites remain untouched"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"^function Section(\\|^function RowCap(\" app/src/components/TodayTab.jsx == 0; grep -c \"<Section\" app/src/components/TodayTab.jsx == 8"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds, no import-resolution errors)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Section supports an optional Mono-styled step prop rendered ahead of the icon, for Grow's later 3 sections; Today's 8 call sites never pass it, so their rendered output is unchanged"
    requirement: "GROW-01"
    verification: []
    human_judgment: true
    rationale: "Visual no-regression on Today's 8 sections and correct step-badge rendering for Grow are folded into Phase 3's end-of-phase regression sweep (plan 03-08), per this plan's own <verification> item 4 — no live Grow caller exists yet in this plan to screenshot against."

# Metrics
duration: 2min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 1: Extract Section/RowCap into ui/Section.jsx Summary

**Extracted TodayTab.jsx's private `Section`/`RowCap`/`HEADING_COLOR` trio into a new shared `app/src/components/ui/Section.jsx`, adding an optional Mono step-index badge, with zero changes to Today's 8 existing call sites**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-18T23:28:00Z
- **Completed:** 2026-08-18T23:29:16Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments
- New `app/src/components/ui/Section.jsx` exports `Section`, `RowCap`, `HEADING_COLOR` as named exports — the mandatory infrastructure prerequisite for Grow's 3 later sections and the RowCap application inside Explore/Coverage/Discover
- `Section` gained a new optional `step` prop (a `Mono`-styled badge rendered before the icon), additive and invisible to Today's 8 existing call sites since none of them pass it
- `TodayTab.jsx` now imports the trio instead of declaring it locally — all 8 pre-existing `<Section>`/`<RowCap>` JSX call sites are byte-identical to before

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ui/Section.jsx with the extracted Section/RowCap/HEADING_COLOR trio plus a new step prop** - `9dc93ec` (feat)
2. **Task 2: Update TodayTab.jsx to import Section/RowCap/HEADING_COLOR instead of declaring them locally** - `2208a48` (refactor)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/components/ui/Section.jsx` - New shared component: `Section` (page-section shell, now with optional `step` badge), `RowCap` (cap/expand-toggle row list), `HEADING_COLOR` (tier-color lookup)
- `app/src/components/TodayTab.jsx` - Removed local `Section`/`RowCap`/`HEADING_COLOR` declarations (39 lines), replaced with a single import from `./ui/Section.jsx`

## Decisions Made
- Extracted verbatim (identical Tailwind classes, identical `border`/`heading` lookup objects, identical JSX structure) rather than refactoring during the move, to guarantee zero visual regression per the plan's must-haves
- `step` renders only when truthy, so it's a pure additive change with no risk to Today's existing rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ui/Section.jsx` is now available for Grow's 3 sections (`GrowTab.jsx`, planned in a later wave of this phase) and for the `RowCap` application inside `ExploreTab.jsx`/`ReferralCoverageTab.jsx`/`DiscoverTab.jsx`
- Production build (`cd app && npm run build`) succeeds with no import-resolution errors
- Manual visual smoke-check of Today's 8 sections is deferred to Phase 3's end-of-phase regression sweep (plan 03-08), per `workflow.human_verify_mode=end-of-phase` — no blocker for this plan's completion

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created/modified files exist on disk and all task/summary commit hashes (9dc93ec, 2208a48, ddaf467) are present in git history.
