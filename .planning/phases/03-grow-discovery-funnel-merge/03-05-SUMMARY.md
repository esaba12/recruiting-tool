---
phase: 03-grow-discovery-funnel-merge
plan: 05
subsystem: ui
tags: [react, tailwind, component-composition]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge
    provides: "app/src/components/ui/Section.jsx — RowCap export (Plan 03-01)"
provides:
  - "DiscoverTab.jsx's zero-targets EmptyState copy corrected (no longer references the dead 'Network → Coverage' nav path)"
  - "DiscoverTab.jsx's ✨ Recommended candidate list capped to 5 via RowCap, with By-company nested lists explicitly left uncapped"
affects: [03-06, 03-07, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DiscoverTab.jsx now consumes ui/Section.jsx's RowCap the same way ExploreTab.jsx (03-03) does, for its own top-level list only"

key-files:
  created: []
  modified:
    - app/src/components/DiscoverTab.jsx

key-decisions:
  - "Left the By-company branch's nested `live.map(...)` render completely untouched — 03-UI-SPEC.md explicitly scopes RowCap capping to top-level lists only, not nested per-company lists"
  - "Made no changes to the existing focus/rowRefs/ring-highlight deep-link mechanic — this plan's scope was strictly the two listed edits"

patterns-established: []

requirements-completed: [GROW-01, GROW-02]

coverage:
  - id: D1
    description: "Zero-targets EmptyState in DiscoverTab.jsx no longer hardcodes a dead 'Network → Coverage' nav path; reads the exact 03-UI-SPEC.md Copywriting Contract copy"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"Network → Coverage\" app/src/components/DiscoverTab.jsx == 0; grep -c \"Add target companies above to see people to reach out to\" app/src/components/DiscoverTab.jsx == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ✨ Recommended candidate list is rendered via RowCap (cap=5) with a 'show all' expander; the By-company branch's nested per-company candidate lists remain an uncapped raw .map()"
    requirement: "GROW-02"
    verification:
      - kind: unit
        ref: "grep -c \"import { RowCap } from './ui/Section.jsx'\" app/src/components/DiscoverTab.jsx == 1; grep -c \"<RowCap items={recommended}\" app/src/components/DiscoverTab.jsx == 1; grep -c \"live.map(c =>\" app/src/components/DiscoverTab.jsx == 1"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 5: DiscoverTab.jsx zero-targets copy fix + Recommended RowCap Summary

**Fixed DiscoverTab.jsx's stale "Network → Coverage" EmptyState copy and capped its ✨ Recommended candidate list to 5 via RowCap, leaving the By-company nested lists and the existing focus/ring-highlight mechanic completely untouched**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-18T23:38:00Z
- **Completed:** 2026-08-18T23:43:23Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Zero-targets `EmptyState` in `DiscoverTab.jsx` now reads "Add target companies above to see people to reach out to — People uses the same list." — no more dead nav-path reference
- `DiscoverTab.jsx` imports `RowCap` from `./ui/Section.jsx` and wraps its top-level `✨ Recommended` candidate list in `<RowCap items={recommended} cap={5} tier="ink" .../>`
- By-company branch's nested `live.map(c => <CandidateCard .../>)` render left byte-identical, per 03-UI-SPEC.md's explicit out-of-cap-scope note
- Existing `focus`/`rowRefs`/ring-highlight deep-link mechanic untouched — this file remains the donor pattern Plan 03-04 ported into `ReferralCoverageTab.jsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the stale zero-targets EmptyState copy** - `8b3c2db` (docs)
2. **Task 2: Apply RowCap (cap=5) to the Recommended candidate list only** - `51320f3` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/components/DiscoverTab.jsx` - Zero-targets `EmptyState` copy corrected; `RowCap` import added; `✨ Recommended` list wrapped in `RowCap(cap=5)`; By-company nested list and focus/highlight mechanic unchanged

## Decisions Made
- Task 1's commit was typed `docs` (copy-only text change, no logic/behavior change) rather than `fix` — the old copy wasn't broken behavior, just a stale string that would point to a dead route once the phase's nav consolidation lands later; no functional bug existed yet at the time of this edit
- Left the By-company branch's nested `live.map(...)` completely unwrapped, per 03-UI-SPEC.md's explicit "Out of cap scope" note — only the plan's two listed edits were made, nothing else in the file was touched

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `DiscoverTab.jsx` is now ready to be wrapped as Grow's "People" section by `GrowTab.jsx` (Plan 03-06), matching its two siblings (`ExploreTab.jsx` from Plan 03-03, `ReferralCoverageTab.jsx` from Plan 03-04)
- Production build (`cd app && npm run build`) succeeds with no import-resolution errors
- Manual smoke check of the focus/scroll/highlight deep-link and the Recommended list's "+N more — Show all" expander is deferred to Plan 03-08's end-of-phase regression sweep, per `workflow.human_verify_mode=end-of-phase` and this plan's own `<verification>` item 4 — no blocker for this plan's completion

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All modified files exist on disk and all task commit hashes (8b3c2db, 51320f3) are present in git history.
