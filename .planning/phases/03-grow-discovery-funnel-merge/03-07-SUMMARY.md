---
phase: 03-grow-discovery-funnel-merge
plan: 07
subsystem: ui
tags: [react, routing, deep-link, dead-code-removal]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge
    provides: "GrowTab.jsx — new page component rendering Companies/Coverage/People as 3 always-present Section-wrapped children, with initialPeopleFocus prop for external deep-linking (Plan 03-06)"
provides:
  - "App.jsx routes tab === 'grow' to <GrowTab> with all 7 required props"
  - "goFindPeople re-pointed to set growFocusCompany + setTab('grow') instead of Network → Discover"
  - "NetworkTab's Coverage/Discover sub-views, focusCompany state, and their dead imports fully removed"
affects: [03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared cross-tab deep-link helper (goFindPeople) re-pointed at its consumer's replacement destination in one place, fixing all call sites (PipelineTab, TodayTab) simultaneously since both pass the same onFindPeople={goFindPeople} prop"

key-files:
  created: []
  modified:
    - app/src/App.jsx

key-decisions:
  - "GrowTab import placed where the removed ExploreTab import previously lived (not literally adjacent to TodayTab's import line as the plan's example suggested) — functionally equivalent, satisfies all acceptance criteria, and avoids reordering unrelated import lines"

patterns-established: []

requirements-completed: [GROW-01, GROW-02]

coverage:
  - id: D1
    description: "Sidebar's 'Grow' nav item renders GrowTab.jsx (tab === 'grow' branch), and the old tab === 'explore' branch / direct <ExploreTab> render is gone"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"tab === 'grow'\" app/src/App.jsx == 1; grep -c \"tab === 'explore'\" app/src/App.jsx == 0"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds)"
        status: pass
    human_judgment: false
  - id: D2
    description: "goFindPeople (shared by PipelineTab's and TodayTab's 'who could I meet here' panels) sets growFocusCompany and setTab('grow'), landing both call sites on Grow's People section instead of the old Network → Discover destination"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c 'setGrowFocusCompany' app/src/App.jsx == 2; grep -c 'Network → Discover' app/src/App.jsx == 0"
        status: pass
    human_judgment: true
    rationale: "Static grep confirms the wiring is structurally correct, but actually clicking 'who could I meet here' from both Pipeline and Today and observing the scroll-and-highlight land on Grow's People section requires the app running live — deferred to Plan 03-08's end-of-phase regression sweep per workflow.human_verify_mode=end-of-phase and this plan's own <verification> item 5."
  - id: D3
    description: "NetworkTab's segmented control no longer offers Coverage or Discover chips; NETWORK_VIEWS trimmed to table/cards/graph/outbox, dead ReferralCoverageTab/DiscoverTab/Target/UserSearch imports and focusCompany state removed"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"key: 'coverage'\\|key: 'discover'\" app/src/App.jsx == 0; grep -c 'import ReferralCoverageTab\\|import DiscoverTab' app/src/App.jsx == 0; grep -c 'useState(initialFocusCompany)' app/src/App.jsx == 0"
        status: pass
      - kind: other
        ref: "cd app && npm run build (confirms no dangling reference to any removed import/state/prop)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The public /demo route is unaffected — 'grow' is not added to DEMO_NAV_ITEMS, mirroring 'explore''s prior absence"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -n \"DEMO_NAV_ITEMS = NAV_ITEMS.filter\" app/src/App.jsx shows exactly ['today', 'overview', 'network', 'pipeline']"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 7: Wire GrowTab into App.jsx routing Summary

**Re-pointed the shared `goFindPeople` deep-link helper from Network → Discover to Grow's People section, swapped `AppInner`'s `tab === 'explore'` branch for `tab === 'grow'` rendering `GrowTab`, and removed `NetworkTab`'s now-dead Coverage/Discover sub-views and their supporting state/imports**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-18T23:52:00Z
- **Completed:** 2026-08-18T23:58:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `App.jsx`'s `AppInner` renamed `networkFocusCompany`/`setNetworkFocusCompany` to `growFocusCompany`/`setGrowFocusCompany`; `goFindPeople`'s body now calls `setGrowFocusCompany({ company, ts: Date.now() })` then `setTab('grow')` — no `setNetworkInitialView('discover')` call, since Grow is not a Network sub-view
- Updated the doc comment above `goFindPeople` to read "Deep-link into Grow's People section... shared by Pipeline's and Today's 'who could I meet here' panels" (corrects the stale "Network → Discover" and "Explore's" references)
- Imported `GrowTab` from `./components/GrowTab.jsx`; removed the now-dead `import ExploreTab` — `App.jsx` no longer renders `<ExploreTab>` directly (`GrowTab.jsx` has its own independent copy)
- Replaced the `tab === 'explore'` JSX block with `tab === 'grow'` rendering `<GrowTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships} onRefresh={load} onRefreshRelationships={refreshContactRelationships} initialPeopleFocus={growFocusCompany} />` — all 7 props match `GrowTab.jsx`'s actual signature from Plan 03-06
- Removed the `<NetworkTab>` render's `initialFocusCompany={networkFocusCompany}` prop pass-through (dangling reference to the renamed variable)
- Updated `DemoApp`'s doc comment: "Explore/Discover/Outbox/..." → "Grow/Outbox/..."; confirmed `DEMO_NAV_ITEMS`'s filter list is unchanged (`['today', 'overview', 'network', 'pipeline']`) — `'grow'` is correctly absent, mirroring `'explore'`'s prior absence
- Trimmed `NETWORK_VIEWS` to exactly `table`, `cards`, `graph`, `outbox` — removed the `coverage`/`discover` entries
- Removed `App.jsx`'s now-unused `import ReferralCoverageTab`, `import DiscoverTab`, and the `Target`/`UserSearch` lucide-react icon imports (both components are now imported only inside `GrowTab.jsx`)
- Removed `NetworkTab`'s `focusCompany`/`setFocusCompany` state, its `initialFocusCompany` prop, and the `view === 'discover'`/`view === 'coverage'` render-ternary clauses — the ternary now starts directly at `view === 'graph'`
- Updated the `DEMO_NETWORK_VIEWS` doc comment to drop the stale "Coverage's 'Find people' deep-links into Discover" sentence and changed "Discover/Outbox call Exa+Claude/GPT" to "Outbox calls Exa+Claude/GPT"
- `cd app && npm run build` succeeds after both tasks, confirming no dangling references to any removed import/state/prop

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-point goFindPeople to Grow and swap the tab === 'explore' branch for tab === 'grow'** - `41575d5` (feat)
2. **Task 2: Remove NetworkTab's dead coverage/discover sub-views and their supporting state/imports** - `5ab4c54` (refactor)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/App.jsx` - `goFindPeople` re-pointed to Grow (`growFocusCompany` replaces `networkFocusCompany`); `tab === 'grow'` routing added, `tab === 'explore'` removed; `GrowTab` imported, `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`/`Target`/`UserSearch` imports removed as dead; `NetworkTab`'s `NETWORK_VIEWS` trimmed to `table/cards/graph/outbox`; `NetworkTab`'s `focusCompany` state and `coverage`/`discover` render branches removed; stale doc comments corrected.

## Decisions Made
- Placed the new `GrowTab` import at the exact line position where the removed `ExploreTab` import previously lived (combined into a single Edit), rather than moving it next to `TodayTab`'s import line as the plan's illustrative example suggested — functionally identical (import order has no runtime effect), satisfies every acceptance criterion, and avoids an unrelated reordering of import lines.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Grow is now reachable from the sidebar (`tab === 'grow'` renders `GrowTab`), both `goFindPeople` call sites (`PipelineTab`, `TodayTab`) resolve through the re-pointed body, and `NetworkTab`'s Coverage/Discover sub-views + all their dead supporting code are fully removed — GROW-01 criterion 3 ("old destinations gone") is now structurally satisfied.
- Production build (`cd app && npm run build`) succeeds with zero dangling references to any removed import/state/prop.
- Manual smoke check of "click Grow in the sidebar", "who could I meet here" from both Pipeline and Today landing on Grow's People section pre-focused, is deferred to Plan 03-08's end-of-phase regression sweep, per `workflow.human_verify_mode=end-of-phase` — no blocker for this plan's completion.

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All modified files exist on disk and both task commit hashes (41575d5, 5ab4c54) are present in git history.
