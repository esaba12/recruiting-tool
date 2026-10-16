---
phase: 03-grow-discovery-funnel-merge
plan: 04
subsystem: ui
tags: [react, tailwind, referral-coverage, deep-link, rowcap]

# Dependency graph
requires:
  - phase: 03-grow-discovery-funnel-merge
    provides: "ui/Section.jsx's RowCap export (Plan 03-01)"
provides:
  - "ReferralCoverageTab.jsx accepts a new optional focus prop ({ company, ts }) driving scroll-to-and-highlight, mirroring DiscoverTab.jsx's existing mechanic"
  - "ReferralCoverageTab.jsx's zero-targets EmptyState no longer collides with an auto-opened textarea; row list capped to 5 via RowCap"
affects: [03-06, 03-07, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "focus={{ company, ts }} deep-link scroll/highlight mechanic (rowRefs Map + useEffect keyed on focus?.ts + ring-2 ring-accent-300) now used by both DiscoverTab.jsx and ReferralCoverageTab.jsx, byte-identical in shape"

key-files:
  created: []
  modified:
    - app/src/components/ReferralCoverageTab.jsx

key-decisions:
  - "Ported DiscoverTab.jsx's focus/rowRefs/ring-highlight mechanic byte-for-byte rather than reinventing it, per the plan's explicit port-not-invent framing"
  - "Textarea auto-expand-on-empty removed by deleting exactly one line (setEditingList(targets.length === 0)) from the [loaded]-gated useEffect, leaving the manual ▼ edit toggle fully intact"

patterns-established: []

requirements-completed: [GROW-01, GROW-02]

coverage:
  - id: D1
    description: "Zero-targets textarea no longer auto-opens; new EmptyState copy ('Add target companies above to see referral gaps.') renders instead, with the textarea still one click away behind its existing ▼ edit toggle"
    requirement: "GROW-02"
    verification:
      - kind: unit
        ref: "grep -c \"setEditingList(targets.length === 0)\" app/src/components/ReferralCoverageTab.jsx == 0; grep -c \"Add target companies above to see referral gaps.\" app/src/components/ReferralCoverageTab.jsx == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "New focus prop drives a scroll-to-and-highlight ring on the matching company row, mirroring DiscoverTab.jsx's existing, unchanged mechanic (rowRefs Map, useEffect keyed on focus?.ts, ring-2 ring-accent-300)"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"useRef(new Map())\" app/src/components/ReferralCoverageTab.jsx == 1; grep -c \"\\[focus?.ts\\]\" app/src/components/ReferralCoverageTab.jsx == 1; grep -c \"ring-2 ring-accent-300\" app/src/components/ReferralCoverageTab.jsx == 1"
        status: pass
      - kind: other
        ref: "cd app && npm run build (production build succeeds)"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that a company row actually highlights with a visible ring when focus targets it (not just that the code compiles) requires GrowTab.jsx to exist as a caller — folded into Plan 03-08's end-of-phase regression sweep per this plan's own <verification> item 5."
  - id: D3
    description: "Row list capped to 5 via RowCap with a 'show all' expander, matching D-02"
    requirement: "GROW-01"
    verification:
      - kind: unit
        ref: "grep -c \"<RowCap items={rows}\" app/src/components/ReferralCoverageTab.jsx == 1"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 4: Prepare ReferralCoverageTab.jsx for Grow Summary

**Fixed Coverage's auto-expanding textarea, swapped in the new pointed-up EmptyState copy, and ported DiscoverTab.jsx's focus/rowRefs/ring-highlight deep-link mechanic plus RowCap(cap=5) onto ReferralCoverageTab.jsx — a byte-level port of an already-shipped pattern, zero new invention**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-18T23:37:00Z
- **Completed:** 2026-08-18T23:40:07Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `ReferralCoverageTab.jsx`'s zero-targets textarea no longer auto-opens (removed `setEditingList(targets.length === 0)`), so it no longer visually collides with the new D-03 EmptyState — the manual `▼ edit` toggle is unchanged and still one click away
- Zero-targets `EmptyState` now shows the exact 03-UI-SPEC.md Copywriting Contract copy: "Add target companies above to see referral gaps."
- New optional `focus` prop (`{ company, ts }`) drives scroll-to-and-highlight via a `rowRefs` ref-Map + a `useEffect` keyed on `[focus?.ts]`, byte-identical in shape to `DiscoverTab.jsx`'s donor pattern (same 100ms `setTimeout`, same `block: 'center'`, same `ring-2 ring-accent-300` conditional class)
- Row list wrapped in `RowCap` (`cap={5}`, `tier="ink"`) — caps the gap/weak/strong row list to 5 with a "show all" expander per D-02
- `cd app && npm run build` succeeds with the merged changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix the auto-expanding textarea and replace the zero-targets EmptyState copy** - `b35616a` (fix)
2. **Task 2: Port the focus/rowRefs/ring-highlight mechanic from DiscoverTab.jsx and apply RowCap** - `cccb01c` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `app/src/components/ReferralCoverageTab.jsx` - Removed auto-expand-on-empty textarea behavior; new zero-targets EmptyState copy; new optional `focus` prop with `rowRefs`/`useEffect`/ring-highlight scroll mechanic (ported from `DiscoverTab.jsx`); row list wrapped in `RowCap` (cap=5)

## Decisions Made
- Ported `DiscoverTab.jsx`'s focus/rowRefs/ring-highlight mechanic byte-for-byte (same 100ms `setTimeout`, `block: 'center'`, `ring-2 ring-accent-300`, dep array `[focus?.ts]`) rather than adapting or simplifying it, per the plan's explicit "byte-level port, not new invention" framing
- Left `warmPathsToCompany`/`companyCoverage` derivation logic, `DraftPanel` cold-outreach integration, and `ContactDetailModal` "+ Add contact" flow completely untouched, per 03-PATTERNS.md's explicit "preserve unchanged" list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ReferralCoverageTab.jsx` is now ready to accept `focus={coverageFocus}` from `GrowTab.jsx` (Plan 03-06), completing the third of three parallel "strip header + wire new prop + apply RowCap" edits (siblings: `ExploreTab.jsx` in Plan 03-03, `DiscoverTab.jsx` in Plan 03-05)
- Production build (`cd app && npm run build`) succeeds with no import-resolution errors
- Visual confirmation of the ring-highlight actually rendering (requires a live `focus` caller, which doesn't exist until `GrowTab.jsx` lands in Plan 03-06/03-07) is deferred to Plan 03-08's end-of-phase regression sweep, per `workflow.human_verify_mode=end-of-phase` — no blocker for this plan's completion

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

All modified files exist on disk and both task commit hashes (b35616a, cccb01c) are present in git history.
