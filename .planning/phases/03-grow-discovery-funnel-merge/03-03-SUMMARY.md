---
phase: 03-grow-discovery-funnel-merge
plan: 03
subsystem: ui
tags: [react, tailwind, component-refactor, section-pattern]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge (Plan 03-01)
    provides: "app/src/components/ui/Section.jsx — shared Section/RowCap/HEADING_COLOR trio, exported for reuse"
provides:
  - "ExploreTab.jsx with its own page-title header removed, ready to be wrapped by GrowTab's Section (Plan 03-06)"
  - "ExploreTab.jsx's new onTargetAdded callback prop, fired from addToTargets"
  - "ExploreTab.jsx's ranked company list capped to 5 via RowCap, with a Show all expander"
affects: [03-06, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ExploreTab now follows the same 'strip own header, add notify-parent callback, apply RowCap' pattern as its siblings ReferralCoverageTab.jsx (03-04) and DiscoverTab.jsx (03-05)"

key-files:
  created: []
  modified:
    - app/src/components/ExploreTab.jsx

key-decisions:
  - "Kept CompanyCard's post-add 'Find people →' button calling onFindPeople(c.name) directly, unrouted through onTargetAdded, per the phase's resolved Open Question 1"
  - "RowCap's renderItem index is scoped to the capped 'visible' array, not the original shown array — accepted as cosmetic-only since it only affects the index<6 GitHub-badge-eligibility check on CompanyCard, which stays correct for the first 5 always-visible cards"

patterns-established: []

requirements-completed: [GROW-01, GROW-02]

coverage:
  - id: D1
    description: "ExploreTab.jsx no longer renders its own <h2>Companies for you</h2> header/subtitle row — Section (its future GrowTab wrapper) will own that title"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"Companies for you\" app/src/components/ExploreTab.jsx == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "ExploreTab accepts a new optional onTargetAdded prop, called as the last statement in addToTargets() after the existing setTargetCompanies/setAdded/lsSet writes, with zero change to that existing write logic"
    requirement: "GROW-02"
    verification:
      - kind: unit
        ref: "grep -c \"onTargetAdded\" app/src/components/ExploreTab.jsx == 2 (prop destructure + call site)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ranked company list is capped to 5 with a 'show all' expander, via RowCap imported from ./ui/Section.jsx, preserving every CompanyCard prop unchanged"
    requirement: "GROW-02"
    verification:
      - kind: unit
        ref: "grep -c \"<RowCap items={shown}\" app/src/components/ExploreTab.jsx == 1"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CompanyCard's post-add 'Find people →' button keeps calling onFindPeople(c.name) directly, unrouted through onTargetAdded, per the phase's resolved Open Question 1"
    requirement: "GROW-02"
    verification: []
    human_judgment: true
    rationale: "Confirming the deep-link jump to People still behaves identically (no visible regression) requires interacting with the running app; folded into Plan 03-08's end-of-phase regression sweep along with the other two sibling components, since ExploreTab is only reachable stand-alone (not yet wrapped by GrowTab) at this point in the phase."

# Metrics
duration: 3min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 3: Prep ExploreTab.jsx for Section wrapping Summary

**Removed ExploreTab's own page-title header, added an onTargetAdded callback fired from addToTargets, and capped its ranked company list to 5 via the shared RowCap component**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-18T23:34:00Z
- **Completed:** 2026-08-18T23:37:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `ExploreTab.jsx` no longer renders its own `<h2>Companies for you</h2>` title/subtitle row — clears the way for `GrowTab.jsx`'s `Section title="Companies"` wrapper (Plan 03-06) to own that chrome without a duplicate header
- New optional `onTargetAdded` prop added to `ExploreTab`'s signature and wired as the final statement in `addToTargets()`, so a parent Grow wrapper can react to a target being added (e.g. D-04's "scroll to Coverage" behavior) without touching any existing localStorage/Supabase write logic
- Ranked company list now renders through `RowCap` (imported from `./ui/Section.jsx`, `cap={5}`, `tier="ink"`) instead of a raw `.map()`, giving a "+N more — Show all" expander per D-02, with every existing `CompanyCard` prop preserved unchanged
- Production build (`cd app && npm run build`) verified green after both edits

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip ExploreTab's own header row and add the onTargetAdded callback prop** - `f52e4ad` (feat)
2. **Task 2: Apply RowCap (cap=5) to the ranked company list** - `92087f6` (refactor)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/components/ExploreTab.jsx` - Removed own `<h2>`/subtitle header block; added `onTargetAdded` prop + call site in `addToTargets`; imported `RowCap` from `./ui/Section.jsx` and replaced the inline `shown.map()` company-card render with `<RowCap items={shown} cap={5} tier="ink" renderItem={...} />`

## Decisions Made
- Per the phase's resolved Open Question 1 (not re-litigated here), `CompanyCard`'s post-add "Find people →" button keeps calling `onFindPeople(c.name)` directly — not routed through `onTargetAdded` or through Coverage. `onTargetAdded` fires only on the initial `+ Add to targets` click.
- Accepted `RowCap`'s `renderItem` index being scoped to the capped `visible` array (not the original `shown` array) as a cosmetic-only difference, per the plan's explicit note — it only affects `CompanyCard`'s `index < 6` GitHub-badge-eligibility gate, which remains correct for the 5 always-visible cards.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ExploreTab.jsx` is now prepped identically to its two siblings (`ReferralCoverageTab.jsx` in Plan 03-04, `DiscoverTab.jsx` in Plan 03-05) for `GrowTab.jsx`'s Section-wrapped composition in Plan 03-06
- Production build succeeds with no import-resolution or regression errors
- Manual smoke-check of add/dismiss/expand/find-people behavior inside ExploreTab is deferred to Plan 03-08's end-of-phase regression sweep, per `workflow.human_verify_mode=end-of-phase` — no blocker for this plan's completion

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created/modified files exist on disk and both task commit hashes (f52e4ad, 92087f6) are present in git history.
