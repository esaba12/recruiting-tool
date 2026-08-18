---
phase: 03-grow-discovery-funnel-merge
plan: 06
subsystem: ui
tags: [react, tailwind, component-composition, deep-link]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge
    provides: "ui/Section.jsx's Section/RowCap trio with step-index badge (Plan 03-01); ExploreTab.jsx's onTargetAdded prop (Plan 03-03); ReferralCoverageTab.jsx's focus prop (Plan 03-04); DiscoverTab.jsx's existing focus prop (Plan 03-05)"
provides:
  - "app/src/components/GrowTab.jsx — new page component rendering Companies/Coverage/People as 3 always-present Section-wrapped children in fixed order"
  - "goToCoverage/goToPeople cross-section scroll-and-highlight handlers, with two independent focus states (coverageFocus/peopleFocus)"
  - "initialPeopleFocus prop, seeding peopleFocus on mount for the external deep-link entry point Plan 03-07 wires into App.jsx"
affects: [03-07, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GrowTab.jsx follows TodayTab.jsx's 'many Sections, one always-rendered page' container shape, but each Section wraps an existing full component instead of a computed list"

key-files:
  created:
    - app/src/components/GrowTab.jsx
  modified: []

key-decisions:
  - "ExploreTab's onFindPeople wired directly to goToPeople (not goToCoverage), preserving the already-added 'Find people ->' button's existing direct-to-People shortcut per the phase's resolved Open Question 1"
  - "Section-level refs placed on plain wrapping <div>s around Coverage/Companies Sections (not on Section itself, which has no ref-forwarding prop), so scrollIntoView targets the whole card"

patterns-established:
  - "GrowTab.jsx: page/component container composing 3 sibling tab components as Section-wrapped children, with cross-section deep-link state owned at the parent — reusable shape for any future multi-stage funnel page"

requirements-completed: [GROW-01, GROW-02]

coverage:
  - id: D1
    description: "GrowTab.jsx default-exports a component rendering Companies, Coverage, and People as 3 always-present stacked Section-wrapped children, in that fixed order, with no tab/accordion switching (D-01)"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c 'step=\"01\"' app/src/components/GrowTab.jsx == 1; grep -c 'step=\"02\"' app/src/components/GrowTab.jsx == 1; grep -c 'step=\"03\"' app/src/components/GrowTab.jsx == 1"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds)"
        status: pass
    human_judgment: false
  - id: D2
    description: "coverageFocus and peopleFocus are two independent useState calls (never merged into one shared object); goToCoverage/goToPeople each scrollIntoView synchronously before setting focus state"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c 'useState(null)' app/src/components/GrowTab.jsx == 1; grep -c 'useState(initialPeopleFocus)' app/src/components/GrowTab.jsx == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking '+ Add to targets' in Companies smooth-scrolls to and highlights the matching row in Coverage; clicking 'Find people' in Coverage smooth-scrolls to and highlights the matching row in People (D-04)"
    requirement: "GROW-01"
    verification: []
    human_judgment: true
    rationale: "Visual confirmation that the scroll-and-highlight actually fires in the browser requires GrowTab to be wired into App.jsx's routing (Plan 03-07) and the app run live — folded into Plan 03-08's end-of-phase regression sweep per this plan's own <verification> item 3."
  - id: D4
    description: "GrowTab accepts an initialPeopleFocus prop that seeds peopleFocus on mount, for the external deep-link entry point Plan 03-07 wires up in App.jsx"
    requirement: "GROW-02"
    verification:
      - kind: unit
        ref: "grep -c 'initialPeopleFocus = null' app/src/components/GrowTab.jsx == 1"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 6: Create GrowTab.jsx Summary

**New `app/src/components/GrowTab.jsx` composing ExploreTab/ReferralCoverageTab/DiscoverTab as 3 always-rendered Section-wrapped stages (Companies -> Coverage -> People), with independent coverageFocus/peopleFocus state driving D-04's scroll-and-highlight cross-section linking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-18T23:45:00Z
- **Completed:** 2026-08-18T23:50:00Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- New `app/src/components/GrowTab.jsx` default-exports `GrowTab`, rendering `ExploreTab`, `ReferralCoverageTab`, and `DiscoverTab` as 3 always-present `Section`-wrapped children in fixed order (Companies `[01]` -> Coverage `[02]` -> People `[03]`), satisfying D-01
- `coverageFocus`/`peopleFocus` are two fully independent `useState` calls (never merged), with `coverageSectionRef`/`peopleSectionRef` on plain wrapping `<div>`s (not on `Section` itself, which has no ref-forwarding prop) — `goToCoverage`/`goToPeople` each call `scrollIntoView({ behavior: 'smooth', block: 'start' })` synchronously before setting their respective focus state, per D-04/RESEARCH.md Pattern 5
- `ExploreTab`'s `onFindPeople` is wired directly to `goToPeople` (not routed through `goToCoverage`), preserving the already-added "Find people →" button's existing direct-to-People shortcut per the phase's resolved Open Question 1
- `initialPeopleFocus` prop (default `null`) seeds `peopleFocus`'s initial state, ready for Plan 03-07's external deep-link wiring in `App.jsx`
- `cd app && npm run build` succeeds standalone with `GrowTab.jsx` present in the tree, confirming no syntax errors and all imports resolve even though the file isn't imported by `App.jsx` until Plan 03-07

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GrowTab.jsx — the 3-section always-rendered page with cross-section focus wiring** - `7ff79aa` (feat)
2. **Task 2: Structural verification — confirm wiring, section-ref placement, and a clean standalone build** - no code changes (verification-only task; all 3 checks — ref placement, scrollIntoView-before-setState ordering, no unused imports — confirmed by direct read, and `npm run build` passed clean)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/components/GrowTab.jsx` - New page component. Default export `GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus })`. Internal: `coverageFocus`/`peopleFocus` state, `coverageSectionRef`/`peopleSectionRef`, `goToCoverage(company)`/`goToPeople(company)` handlers.

## Decisions Made
- Task 2 made zero additional edits — Task 1's output already satisfied all three structural checks (ref placement on wrapping `<div>`s, `scrollIntoView`-before-`setState` sequencing, no unused imports), so Task 2 was purely confirmatory per its own plan text ("this task performs no further edits ... unless any of these three checks fails")
- `onRefreshRelationships` is accepted in the prop signature but not consumed inside this file — none of the 3 wrapped children currently take that prop; it exists purely so `App.jsx` (Plan 03-07) has a consistent prop surface to pass, matching the sibling pattern already established by `TodayTab.jsx`'s own `onRefreshRelationships` prop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GrowTab.jsx` exists, compiles standalone, and structurally implements D-01 through D-05 exactly as `03-CONTEXT.md`/`03-UI-SPEC.md` specify — ready for Plan 03-07 to wire into `App.jsx`'s routing (replacing the `'explore'` nav branch and `NetworkTab`'s `'coverage'`/`'discover'` sub-views) and to re-point `goFindPeople`'s deep-link target
- Production build (`cd app && npm run build`) succeeds with no import-resolution errors
- Manual smoke check of the full Companies→Coverage→People scroll-and-highlight flow and the external deep-link entry point is deferred to Plan 03-08's end-of-phase regression sweep, per `workflow.human_verify_mode=end-of-phase` — no blocker for this plan's completion

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created files exist on disk and the task commit hash (7ff79aa) is present in git history.
