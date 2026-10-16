---
phase: 02-unified-attention-feed-today
plan: 01
subsystem: ui
tags: [react, attention-feed, refactor, lucide-react]

# Dependency graph
requires:
  - phase: 01-visual-foundation-industrial-design-tokens-primitives
    provides: ink/accent design tokens, Mono primitive, Section-card visual convention
provides:
  - "app/src/lib/attention.js — 8 named derivation functions + keepInTouchDue re-export, verbatim ported from ActionsTab.jsx"
  - "NAV_ICON.today (Gauge) added additively to app/src/lib/icons.js"
  - "TimelineFindsPanel.jsx refactored to Section-card chrome with onPendingChange callback"
affects: [02-02-today-tab, 02-03-nav-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation modules (lib/attention.js) extract inline component filter/sort logic into named exports, mirroring lib/keepInTouch.js's existing shape"
    - "Section-card chrome convention: bg-white rounded-xl p-5 shadow-sm border border-{tier}-200, text-sm font-semibold heading, Mono-wrapped relative-time subtitle"

key-files:
  created:
    - app/src/lib/attention.js
  modified:
    - app/src/lib/icons.js
    - app/src/components/TimelineFindsPanel.jsx

key-decisions:
  - "Ported ActionsTab.jsx's filter/sort logic verbatim into attention.js with zero behavior changes, per D-06 — no invented derivation logic"
  - "keepInTouchDue is a thin re-export of keepInTouch.js's keepInTouchQueue, not a reimplementation, keeping keepInTouch.js the single source of truth for cadence math"
  - "TimelineFindsPanel's accordion (open/setOpen) was removed entirely rather than defaulted open — content always renders now, matching the Section convention where sections don't collapse"

patterns-established:
  - "Attention-feed section header pattern: icon + title + count in an h2, Rescan/action control on the same flex row, Mono-wrapped last-scan timestamp in the subtitle paragraph"

requirements-completed: [ATTN-01]

coverage:
  - id: D1
    description: "app/src/lib/attention.js exports 8 named derivation functions (activeApps, oaDue, oaNeedsCheck, wantToSchedule, overdueFollowUps, staleApplications, highUrgencyContacts, needsReviewApps) plus a keepInTouchDue re-export, each behaviorally identical to the ActionsTab.jsx/keepInTouch.js logic they were extracted from"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "bash grep+node --check verification embedded in 02-01-PLAN.md Task 1 <verify> block"
        status: pass
    human_judgment: false
  - id: D2
    description: "NAV_ICON.today (Gauge) added additively to app/src/lib/icons.js; NAV_ICON.actions untouched"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "bash grep+node --check verification embedded in 02-01-PLAN.md Task 2 <verify> block"
        status: pass
    human_judgment: false
  - id: D3
    description: "TimelineFindsPanel.jsx renders Section-matching chrome (icon, title, count, tier-4 accent border, Rescan control, Mono-wrapped last-scan timestamp) with the accordion removed and onPendingChange added; scan/dismiss/updateField/approve unchanged; CalendarTab.jsx's existing mount still builds"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "bash grep verification embedded in 02-01-PLAN.md Task 3 <verify> block"
        status: pass
      - kind: integration
        ref: "cd app && npm run build"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-16
status: complete
---

# Phase 2 Plan 1: Attention Feed Foundation Summary

**Extracted `lib/attention.js`'s 8-function derivation module from ActionsTab.jsx's inline filters, added the `Gauge` Today nav icon, and restyled TimelineFindsPanel's chrome to match the Section card convention — all zero-behavior-change groundwork for Plan 02-02's TodayTab.jsx.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-16T20:50:40Z
- **Completed:** 2026-08-16T20:52:43Z
- **Tasks:** 3 completed
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments
- `app/src/lib/attention.js` created with `activeApps`, `oaDue`, `oaNeedsCheck`, `wantToSchedule`, `overdueFollowUps`, `staleApplications`, `highUrgencyContacts`, `needsReviewApps`, plus a `keepInTouchDue` re-export of `keepInTouch.js`'s `keepInTouchQueue` — every function a verbatim port of the cited `ActionsTab.jsx` lines, no logic invented.
- `NAV_ICON.today` (`Gauge` from `lucide-react`) added as the first key in `app/src/lib/icons.js`'s `NAV_ICON` map, additive-only — `NAV_ICON.actions` (`ListChecks`) is untouched since `Sidebar.jsx`'s `NAV_ITEMS` still reaches it until Plan 02-03's cutover.
- `TimelineFindsPanel.jsx`'s bespoke gradient/accordion header replaced with `Section`-matching chrome (`bg-white rounded-xl p-5 shadow-sm border border-accent-200`, `CalendarSearch` icon, count in the heading, Mono-wrapped last-scan relative time) and a new `onPendingChange` callback fired on every `pending` change — `scan`/`dismiss`/`updateField`/`approve` and the pending-card markup are byte-for-byte unchanged; `CalendarTab.jsx`'s existing mount still builds and renders.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/src/lib/attention.js (per D-06)** - `b215043` (feat)
2. **Task 2: Add the Today nav icon to app/src/lib/icons.js (additive only, per D-03)** - `e5fdd78` (feat)
3. **Task 3: Refactor TimelineFindsPanel.jsx's chrome to match the Section card convention** - `ee64e6f` (feat)

## Files Created/Modified
- `app/src/lib/attention.js` - New attention-derivation module, 8 named exports + re-export
- `app/src/lib/icons.js` - Added `Gauge` import + `NAV_ICON.today` entry
- `app/src/components/TimelineFindsPanel.jsx` - Section-card chrome refactor, removed accordion state, added `onPendingChange` prop

## Decisions Made
- Followed `02-PATTERNS.md`'s pre-specified `attention.js` code verbatim (import shape, function bodies, re-export line) — no deviation from the locked pattern.
- Removed `TimelineFindsPanel`'s `open`/`setOpen` state entirely rather than defaulting it to `true`, since the plan's intent was "no accordion at all," matching the other attention-feed sections which always render their content.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `app/src/lib/attention.js`'s exported function names are stable and ready for Plan 02-02's `TodayTab.jsx` to import verbatim.
- `TimelineFindsPanel.jsx`'s new `onPendingChange` prop is ready for Plan 02-02's page-level all-sections-empty check.
- `NAV_ICON.today` exists but is not yet wired into `Sidebar.jsx`'s `NAV_ITEMS` — that cutover, along with `NAV_ICON.actions`'s removal, is correctly deferred to Plan 02-03 per this plan's explicit scope boundary.
- No blockers.

---
*Phase: 02-unified-attention-feed-today*
*Completed: 2026-08-16*

## Self-Check: PASSED

All 4 created/modified files found on disk; all 3 task commit hashes found in git log.
